// const {randomUUID} = require("crypto");

// const prisma = require("../config/prisma");

// const inventoryService = require("../services/inventoryService");

// // NAIVE VERSION — deliberately built this way first to expose the gap.
// // Flow: reserve stock in Inventory, THEN create the order record.
// // The problem: if this process crashes (or the DB write fails) AFTER
// // Inventory successfully reserves stock but BEFORE the order record is
// // created, that stock is now reserved forever for an order that doesn't
// // exist anywhere. No compensating action has been triggered because we
// // never got the chance to call it.

// async function createOrder(req, res, next){
//     try{
//       const { userId, items } = req.body;

//       if (!userId || !Array.isArray(items) || !items.length < 1) {
//         return res.status(400).json({
//           message: "userId and atleast 1 items is required.",
//         });
//       }

//       const orderId = randomUUID();
//       // generated BEFORE reserving, so both
//       // services agree on the same ID
//       // Reserve stock for every item first. NOTE: this only reserves the
//       // FIRST item for simplicity right now — multi-item reservation
//       // consistency is its own harder problem we're deliberately not
//       // solving yet, to keep focus on the single-item crash gap.

//       const item = items[0];
//       await inventoryService.reserveStock(
//         orderId,
//         item.productId,
//         item.quantity,
//       );

//       // TEMPORARY: simulating a crash right at the gap
//       throw new Error(
//         "Simulated crash after reservation, before order creation",
//       );

//       // ⚠️ THE GAP: if the process crashes right here — server restart,
//       // out-of-memory kill, deploy mid-request, anything — stock is
//       // reserved in Inventory, but no Order record will ever exist to
//       // say why, or to later confirm/release it.

//       const totalPrice = items.reduce(
//         (sum, i) => sum + i.price * i.quantity,
//         0,
//       );

//       const order = await prisma.order.create({
//         data: {
//           id: orderId,
//           userId,
//           totalPrice,
//           status: "pending",
//           items: {
//             create: items.map((i) => ({
//               productId: i.productId,
//               name: i.name,
//               price: i.price,
//               quantity: i.quantity,
//             })),
//           },
//         },
//         include: { items: true },
//       });
//       // Assume payment succeeds instantly for now — Payment service comes
//       // in Phase 5. For now, confirm the reservation right away.

//       await inventoryService.confirmReservation(orderId);

//       const confirmOrder = await prisma.order.update({
//         where: { id: orderId },
//         data: { status: "confirmed" },
//         include: { items: true },
//       });

//       res.status(201).json(confirmOrder);
//     }catch(err){
//         next(err)
//     }
// }

// async function getOrder(req, res, next){
//     try{
//         const order = await prisma.order.findUnique({
//             where: {id: req.params.id},
//             include: {items: true}
//         });
//         if(!order){
//             return res.status(404).json({
//                 message: "Order not found."
//             })
//         }
//         res.status(200).json(order);
//     }catch(err){
//         next(err)
//     }
// }

// module.exports = {createOrder, getOrder};

const { randomUUID } = require("crypto");
const {handlePaymentFailure, handlePaymentSuccess} = require("../services/paymentOrderService")

const prisma = require("../config/prisma");

const inventoryService = require("../services/inventoryService");
const catalogService = require("../services/catalogService");
const { safeRelease } = require("../services/orderSagaService");

async function createOrder(req, res, next) {
  let orderId = null;
  let inventoryReserved = false;

  try {
    const { userId, items } = req.body;

    // ---------------------------------------------------------
    // 1. Validate the request
    // ---------------------------------------------------------

    if (!userId || !Array.isArray(items) || items.length < 1) {
      return res.status(400).json({
        message: "userId and at least 1 item are required.",
      });
    }

    // ---------------------------------------------------------
    // 2. Get product information from Catalog Service
    // ---------------------------------------------------------
    // The client is NOT trusted for name/price.
    // Catalog Service is the source of truth.
    //
    // We first fetch every product and build our order items
    // from the catalog response.
    // ---------------------------------------------------------

    const orderItems = [];

    for (const item of items) {
      if (
        !item ||
        !item.productId ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      ) {
        return res.status(400).json({
          message:
            "Every item needs a productId and a positive integer quantity.",
        });
      }

      const product = await catalogService.getProductById(item.productId);

      if (!product) {
        return res.status(404).json({
          message: `Product ${item.productId} not found.`,
        });
      }

      orderItems.push({
        productId: product._id || product.id || item.productId,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
      });
    }

    // ---------------------------------------------------------
    // 3. Calculate the total from Catalog prices
    // ---------------------------------------------------------

    const totalPrice = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // ---------------------------------------------------------
    // 4. Generate the Order ID BEFORE talking to Inventory
    // ---------------------------------------------------------
    // This same ID is used by both services.
    // It becomes the saga's correlation/identity key.
    // ---------------------------------------------------------

    orderId = randomUUID();

    // ---------------------------------------------------------
    // 5. Create the order as PENDING
    // ---------------------------------------------------------
    // We deliberately create the order BEFORE reserving inventory.
    //
    // Why?
    //
    // If our process crashes after this point, we have a database
    // record showing that an unfinished order exists.
    //
    // A recovery process can later find this pending order and
    // determine what happened.
    // ---------------------------------------------------------

    const order = await prisma.order.create({
      data: {
        id: orderId,
        userId,
        totalPrice,
        status: "pending",
        items: {
          create: orderItems.map((item) => ({
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    // ---------------------------------------------------------
    // 6. Reserve ALL items in Inventory
    // ---------------------------------------------------------
    // Inventory performs this atomically in its own database.
    //
    // If one product doesn't have enough stock, Inventory rolls
    // back every reservation belonging to this request.
    // ---------------------------------------------------------

    try {
      await inventoryService.reserveStock(
        orderId,
        orderItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      );

      inventoryReserved = true;
    } catch (inventoryError) {
      // Inventory explicitly rejected the reservation.
      //
      // Because reserveStock is atomic, there should not be a
      // partial reservation left behind.
      //
      // Mark our order as failed.

      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "failed",
        },
      });

      throw inventoryError;
    }

    // ---------------------------------------------------------
    // 7. Confirm the reservation
    // ---------------------------------------------------------
    //
    // Payment does NOT exist yet.
    // That belongs to Phase 5.
    //
    // Therefore, for Phase 4 we assume payment succeeds and
    // immediately confirm the inventory reservation.
    // ---------------------------------------------------------

    try {
      await inventoryService.confirmReservation(orderId);
    } catch (confirmError) {
      // -------------------------------------------------------
      // Confirmation failed.
      //
      // IMPORTANT:
      //
      // We know inventory was successfully reserved, so this is
      // now a compensation situation.
      //
      // Try to release the reservation.
      // -------------------------------------------------------

      await safeRelease(orderId);

      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "failed",
        },
      });

      throw confirmError;
    }

    // ---------------------------------------------------------
    // 8. Mark our Order as CONFIRMED
    // ---------------------------------------------------------

    const confirmedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "confirmed",
      },
      include: {
        items: true,
      },
    });

    // ---------------------------------------------------------
    // 9. Return the completed order
    // ---------------------------------------------------------

    return res.status(201).json(confirmedOrder);
  } catch (err) {
    next(err);
  }
}

async function getOrder(req, res, next) {
  try {
    const order = await prisma.order.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found.",
      });
    }

    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
}

async function paymentSuccess(req, res, next) {
  try {
    const order = await handlePaymentSuccess(req.params.id);

    res.status(200).json({
      message: "Payment success processed.",
      order,
    });
  } catch (err) {
    next(err);
  }
}

async function paymentFailure(req, res, next) {
  try {
    const order = await handlePaymentFailure(req.params.id);

    res.status(200).json({
      message: "Payment failure processed.",
      order,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrder,
  getOrder,
  paymentFailure,
  paymentSuccess
};