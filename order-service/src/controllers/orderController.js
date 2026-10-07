const { randomUUID } = require("crypto");

const prisma = require("../config/prisma");

const inventoryService = require("../services/inventoryService");
const catalogService = require("../services/catalogService");


const {
  handlePaymentFailure,
  handlePaymentSuccess,
} = require("../services/paymentOrderService");

async function createOrder(req, res, next) {
  let orderId = null;

  try {
    const { userId, items } = req.body;

    // ---------------------------------------------------------
    // 1. Validate request
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
    // 3. Calculate total from Catalog prices
    // ---------------------------------------------------------

    const totalPrice = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // ---------------------------------------------------------
    // 4. Generate Order ID
    // ---------------------------------------------------------

    orderId = randomUUID();

    // ---------------------------------------------------------
    // 5. Create order as PENDING
    // ---------------------------------------------------------
    // IMPORTANT:
    //
    // The order MUST remain pending until payment succeeds.
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
    // 6. Reserve inventory
    // ---------------------------------------------------------
    // Inventory is reserved, but NOT confirmed.
    //
    // The reservation remains pending until payment succeeds.
    // ---------------------------------------------------------

    try {
      await inventoryService.reserveStock(
        orderId,
        orderItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      );
    } catch (inventoryError) {
      // Inventory rejected the reservation.
      // Mark the order as failed.

      await prisma.order.update({
        where: {
          id: orderId,
        },
        data: {
          status: "failed",
        },
      });

      throw inventoryError;
    }

    // ---------------------------------------------------------
    // 7. DO NOT CONFIRM INVENTORY HERE
    // ---------------------------------------------------------
    //
    // Payment Service is now responsible for deciding whether
    // the reservation should be confirmed or released.
    //
    // Flow:
    //
    // pending order
    //      +
    // reserved inventory
    //      ↓
    // Payment Service
    //      ↓
    // payment success → confirm reservation
    // payment failure → release reservation
    //
    // ---------------------------------------------------------

    return res.status(201).json(order);
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
  paymentSuccess,
};
