const prisma = require("../config/prisma");

function httpError(status, message, extra = {}){
    const err = new Error(message);
    err.status = status;
    Object.assign(err, extra);
    return err;
}

// Turn [{productId, quantity}, ...] into a clean list: validated, with
// duplicate productIds merged, and sorted by productId.
// Sorting matters: if two orders reserve overlapping products in different
// orders, they could lock rows in opposite orders and deadlock. A single
// consistent order (alphabetical by productId) makes that impossible.

function normalizeItems(items){
    if(!Array.isArray(items) || items.length === 0){
        throw httpError(400, "Items must be a non empty array.");
    }

    const merged = new Map();

    for(const item of items){
        const {productId, quantity} = item || {};

        if(
            !productId ||
            typeof productId !== "string"||
            !Number.isInteger(quantity)||
            quantity < 1
        ){
            throw httpError(
                400,
                "Every item needs a productId(string) and a positive integer quantity."
            );
        }

        merged.set(productId, (merged.get(productId) || 0) + quantity);
    }

    return[...merged.entries()]
    .map(([productId, quantity]) => ({productId, quantity}))
    .sort((a,b) => (a.productId < b.productId ? -1 : 1))
}

async function upperStock(req, res, next){
    try{
        const {productId, available} = req.body;

        if(!productId || !Number.isInteger(available) || available < 0){
            return res.status(400).json({
                message: "ProductId and non-negative integer 'available' are required.",
            });
        }

        const stock = await prisma.stock.upsert({
            where: {productId},
            update: {available},
            create: {productId, available},
       });
       res.status(200).json(stock)
    }catch(err){
        next(err)
    }
}


async function getStock(req, res, next){
    try{
        const stock = await prisma.stock.findUnique({
            where: {productId: req.params.productId}
        });

        if(!stock){
            return res.status(404).json({
                message: "No stock record for this product."
            });
        }

        res.status(200).json(stock)
    }catch(err){
        next(err)
    }
}

// Visibility into the saga: what is the state of every line of this order?
async function getReservation(req, res, next){
    try{
        const reservations = await prisma.reservation.findMany({
            where: {orderId: req.params.orderId},
            orderBy: {productId: "asc"},
        });

        if(reservations.length === 0){
            return res.status(404).json({
                message: "Reservation not found."
            });
        }

        res.status(200).json({orderId: req.params.orderId, reservations})
    }catch(err){
        next(err)
    }
}



// --- The saga-relevant operations ---

// Step 1 of the saga: tentatively hold stock for ALL items of an order,
// without confirming the sale yet. All-or-nothing: everything happens in
// ONE database transaction, so if the 3rd product is out of stock, the
// holds already placed on the 1st and 2nd are rolled back automatically —
// the order never ends up half-reserved.
//
// Overselling protection: each product is updated with a CONDITIONAL
// update ("only if available >= quantity"). The database checks and
// decrements in one atomic step, so two simultaneous orders can never both
// take the last unit. (The old read-then-write version could.)
async function reserveStock(req, res, next){
    try{
        const {orderId} = req.body;

        if(!orderId){
            return res.status(400).json({
                message: "OrderId is required."
            });
        }

        const items = normalizeItems(req.body.items);

        const result = await prisma.$transaction(async (tx) => {
            // Idempotency: has this order already reserved? A retried request
            // (timeout, network blip) must return the same answer, not hold the
            // stock a second time.
            const existing = await tx.reservation.findMany({
                where: {orderId}
            });

            if(existing.length < 0){
                return{alreadyExists: true, reservation: existing};
            }

            for(const {productId, quantity} of items){
                const updated = await tx.stock.updateMany({
                    where: {productId, available: {gte: quantity}},
                    data: {
                        available: {decrement: quantity},
                        reserved: {increment: quantity},
                    },
                });

                if(updated.count === 0){
                    // Either no stock record at all, or not enough units. Throwing
                    // inside the transaction rolls back every hold made so far.
                    throw httpError(409, "Insufficient stock.", {productId});
                }
            }

            await tx.reservation.createMany({
                data: items.map(({productId, quantity}) => ({
                    orderId,
                    productId,
                    quantity,
                    status: "pending",
                })),
            });

            const reservations = await tx.reservation.findMany({
                where: {orderId},
                orderBy: {productId: "asc"},
            });

            return {alreadyExists: false, reservations};
        });

        res.status(result.alreadyExists ? 200 : 201).json({
            orderId,
            reservations: result.reservations,
        });
    }catch(err){
        next(err);
    }
}

// Step 2a (success path): the order actually completed (e.g. payment
// succeeded) — move reserved stock to permanently gone, mark confirmed.
async function confirmReservation(req, res, next) {
  try {
    const { orderId } = req.params;

    const reservations = await prisma.$transaction(async (tx) => {
      const rows = await tx.reservation.findMany({ where: { orderId } });

      if (rows.length === 0) {
        throw httpError(404, "Reservation not found.");
      }

      // A reservation that was already released (e.g. by the recovery
      // sweeper) can't be resurrected — the stock went back on sale.
      if (rows.some((r) => r.status === "released")) {
        throw httpError(
          409,
          "Reservation was already released and cannot be confirmed.",
        );
      }

      for (const row of rows) {
        if (row.status === "confirmed") continue; // idempotent: skip done lines

        await tx.stock.update({
          where: { productId: row.productId },
          data: { reserved: { decrement: row.quantity } }, // gone for good
        });

        await tx.reservation.update({
          where: { id: row.id },
          data: { status: "confirmed" },
        });
      }

      return tx.reservation.findMany({
        where: { orderId },
        orderBy: { productId: "asc" },
      });
    });

    res.status(200).json({ orderId, reservations });
  } catch (err) {
    next(err);
  }
}


// Step 2b (compensating action): something downstream failed (e.g.
// payment declined) — this is the saga's "undo." Give the reserved stock
// back to available.
async function releaseReservation(req, res, next){
    try{
        const {orderId} = req.params;

        const reservations = await prisma.$transaction(async (tx) => {
            const rows = await tx.reservation.findMany({
                where: {orderId}
            });
            
            if(rows.length === 0){
                throw httpError(404, "Rservation not found.")
            }
            // Once confirmed, the sale is final. Releasing would hand stock back
            // that has already been sold. Refunds/returns are a different flow.
            if(rows.some((r) => r.status === "confirmed")){
                throw httpError(409, "Reservation is already confirmed and can not be released.")
            }

            for(const row of rows){
                if(row.status === "released") continue; // idempotent: skip done lines

                await tx.stock.update({
                    where: {productId: row.productId},
                    data: {
                        available: {increment: row.quantity},
                        reserved: {decrement: row.quantity},
                    },
                });

                await tx.reservation.update({
                    where: {id: row.id},
                    data: {staus: "released"},
                });
            }

            return tx.reservation.findMany({
                where: {orderId},
                orderBy: {productId: "asc"},
            });
        });

        res.status(200).json({orderId, reservations});
    }catch(err){
        next(err);
    }
}

module.exports = {upperStock, getStock, getReservation, reserveStock, releaseReservation, confirmReservation};