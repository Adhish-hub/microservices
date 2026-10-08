const prisma = require("../config/prisma");

const inventoryService = require("../services/inventoryService");
const catalogService = require("../services/catalogService");

const { createOutboxEvent } = require("../services/outboxService");

const {
  handlePaymentFailure,
  handlePaymentSuccess,
} = require("../services/paymentOrderService");

async function createOrder(req, res, next) {
  try {
    const { items } = req.body;

    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({
        message: "Authenticated userId is missing.",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "At least one item is required.",
      });
    }

    const orderItems = [];
    let totalPrice = 0;

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({
          message: "Each item must contain a valid productId and quantity.",
        });
      }

      const product = await catalogService.getProductById(item.productId);

      if (!product) {
        return res.status(404).json({
          message: `Product ${item.productId} not found.`,
        });
      }

      const quantity = Number(item.quantity);
      const price = Number(product.price);

      orderItems.push({
        productId: product._id || product.id,
        name: product.name,
        price,
        quantity,
      });

      totalPrice += price * quantity;
    }

    /*
     * Create the order and its outbox event
     * in the same database transaction.
     */
    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
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

      await createOutboxEvent(tx, {
        eventType: "order.created",
        aggregateType: "Order",
        aggregateId: createdOrder.id,

        payload: {
          orderId: createdOrder.id,
          userId: createdOrder.userId,
          totalPrice: createdOrder.totalPrice,
          status: createdOrder.status,
          items: createdOrder.items,
        },
      });

      return createdOrder;
    });

    /*
     * Reserve inventory for all order items atomically.
     */
    try {
      await inventoryService.reserveStock(
        order.id,
        order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      );
    } catch (inventoryError) {
      /*
       * Inventory reservation failed.
       *
       * Mark the order as failed and create an
       * order.failed outbox event.
       */
      await prisma.$transaction(async (tx) => {
        const failedOrder = await tx.order.update({
          where: {
            id: order.id,
          },

          data: {
            status: "failed",
          },

          include: {
            items: true,
          },
        });

        await createOutboxEvent(tx, {
          eventType: "order.failed",
          aggregateType: "Order",
          aggregateId: failedOrder.id,

          payload: {
            orderId: failedOrder.id,
            userId: failedOrder.userId,
            totalPrice: failedOrder.totalPrice,
            status: failedOrder.status,
            reason: "inventory_reservation_failed",
            items: failedOrder.items,
          },
        });
      });

      throw inventoryError;
    }

    return res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

async function getOrder(req, res, next) {
  try {
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({
        message: "Authenticated user ID is missing.",
      });
    }

    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        userId,
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
  paymentSuccess,
};
