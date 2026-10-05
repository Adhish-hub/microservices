const {randomUUID} = require("crypto");

const prisma = require("../config/prisma");

const inventoryService = require("../services/inventoryService");

// NAIVE VERSION — deliberately built this way first to expose the gap.
// Flow: reserve stock in Inventory, THEN create the order record.
// The problem: if this process crashes (or the DB write fails) AFTER
// Inventory successfully reserves stock but BEFORE the order record is
// created, that stock is now reserved forever for an order that doesn't
// exist anywhere. No compensating action has been triggered because we
// never got the chance to call it.

async function createOrder(req, res, next){
    try{
      const { userId, items } = req.body;

      if (!userId || !items || !items.length < 1) {
        return res.status(400).json({
          message: "userId and atleast 1 items is required.",
        });
      }

      const orderId = randomUUID();
      // generated BEFORE reserving, so both
      // services agree on the same ID
      // Reserve stock for every item first. NOTE: this only reserves the
      // FIRST item for simplicity right now — multi-item reservation
      // consistency is its own harder problem we're deliberately not
      // solving yet, to keep focus on the single-item crash gap.

      const item = items[0];
      await inventoryService.reserveStock(
        orderId,
        item.productId.item.quantity,
      );

      // TEMPORARY: simulating a crash right at the gap
      throw new Error(
        "Simulated crash after reservation, before order creation",
      );

      // ⚠️ THE GAP: if the process crashes right here — server restart,
      // out-of-memory kill, deploy mid-request, anything — stock is
      // reserved in Inventory, but no Order record will ever exist to
      // say why, or to later confirm/release it.

      const totalPrice = items.reduce(
        (sum, i) => sum + i.price * i.quantity,
        0,
      );

      const order = await prisma.order.create({
        data: {
          id: orderId,
          userId,
          totalPrice,
          status: "pending",
          items: {
            create: items.map((i) => ({
              productId: i.productId,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
            })),
          },
        },
        include: { items: true },
      });
      // Assume payment succeeds instantly for now — Payment service comes
      // in Phase 5. For now, confirm the reservation right away.

      await inventoryService.confirmReservation(orderId);

      const confirmOrder = await prisma.order.update({
        where: { id: orderId },
        data: { status: "confirmed" },
        include: { items: true },
      });

      res.status(201).json(confirmOrder);
    }catch(err){
        next(err)
    }
}


async function getOrder(req, res, next){
    try{
        const order = await prisma.order.findUnique({
            where: {id: req.params.id},
            include: {items: true} 
        });
        if(!order){
            return res.status(404).json({
                message: "Order not found."
            })
        }
        res.status(200).json(order);
    }catch(err){
        next(err)
    }
}

module.exports = {createOrder, getOrder};