const prisma = require("../config/prisma")

async function upperStock(req, res, next){
    try{
        const {productId, available} = req.body;

        if(!productId || available === undefined){
            return res.status(400).json({
                message: "productId and available are required."
            })
        }

        const stock = await prisma.stock.upsert({
            where: {productId},
            update: {available},
            create: {productId, available}
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
            })
        }
        res.status(200).json(stock)
    }catch(err){
        next(err)
    }
}

 
// --- The saga-relevant operations ---
 
// Step 1 of the saga: tentatively hold stock for an order, without
// confirming the sale yet. This is a single, atomic database operation —
// Prisma's $transaction ensures the stock check and the update happen
// together, so two simultaneous requests can't both succeed in reserving
// more than what's actually available.

async function reserveStock(req, res, next){
    try{
        const {orderId, productId, quantity} = req.body;

        if(!orderId || !productId || !quantity || quantity < 1){
            return res.status(400).json({
                message: "orderId, productId and positive quantity are required."
            })
        }

        const result = await prisma.$transaction(async (tx) => {
             // Idempotency check: has this exact order already tried this?
            const existing = await tx.reservation.findUnique({
                where: {orderId}
            })

            if(existing){
                return {alreadyExists: true, reservation: existing}
            }

            const stock = await tx.stock.findUnique({
                where: {productId}
            })

            if(!stock || stock.available < quantity){
                const insufficientError = new Error("Insufficient stock");

                insufficientError.status = 409;
                throw insufficientError
            }

            await tx.stock.update({
                where: {productId},
                data: {
                    available: stock.available - quantity,
                    reserved: stock.reserved + quantity,
                },
            });

            const reservation = await tx.reservation.create({
                data: {orderId, productId, quantity, status: "pending"}
            });
            return {alreadyExists: false, reservation};
        });
        res.status(result.alreadyExists ? 200 : 201).json(result.reservation)
    }catch(err){
        next(err);
    }
}


// Step 2a (success path): the order actually completed (e.g. payment
// succeeded) — move reserved stock to permanently gone, mark confirmed.

async function confirmReservation(req, res, next){
    try{
        const {orderId} = req.params;

        const result = await prisma.$transaction(async (tx) => {
            const reservation = await tx.reservation.findUnique({
                where: {orderId}
            });

            if(!reservation){
                const notFoundError = new Error("Reservation not found");
                notFoundError.status = 404;
                throw notFoundError;
            }

            if(reservation.status === "confirmed"){
                return reservation
            }

            await tx.stock.update({
                where: {productId: reservation.productId},
                data: {reserved: {decrement: reservation.quantity}} //stock is gone for good
            });

            return tx.reservation.update({
                where: {orderId},
                data: {status: "confirmed"},
            });
        });

        res.status(200).json(result)
    }catch(err){
        next(err)
    }
}


// Step 2b (compensating action): something downstream failed (e.g.
// payment declined) — this is the saga's "undo." Give the reserved
// stock back to available.


async function releaseReservation(req, res, next){
    try{
        const {orderId} = req.params;

        const result = await prisma.$transaction(async (tx) => {
            const reservation = await tx.reservation.findUnique({
                where: {orderId}
            });

            if(!reservation){
                const notFoundError = new Error("Reservation not found.");
                notFoundError.status = 404;
                throw notFoundError;
            }
            if(reservation.status === "released"){
                return reservation;
            }

            await tx.Stock.update({
                where: {productId: reservation.productId},
                data: {
                    available: {increment: reservation.quantity},
                    reserved: {decrement: reservation.quantity},
                },
            });

            return tx.reservation.update({
                where: {orderId},
                data: {status: "released"}
            });
        });

        res.status(200).json(result)
    }catch(err){
        next(err)
    }
}

module.exports = {upperStock, getStock, reserveStock, confirmReservation, releaseReservation}