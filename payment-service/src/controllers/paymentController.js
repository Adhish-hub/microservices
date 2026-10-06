const prisma = require("../config/prisma");
const razorpay = require("../config/razorpay");

const {
  getOrderById,
  notifyPaymentSuccess,
  notifyPaymentFailure,
} = require("../services/orderService");

const {
  verifyPaymentSignature,
} = require("../services/paymentVerificationService");

async function createPayment(req, res, next) {
  try {
    const idempotencyKey = req.get("Idempotency-Key");

    if (!idempotencyKey) {
      return res.status(400).json({
        message: "Idempotency-Key header is required.",
      });
    }

    if (idempotencyKey.length > 100) {
      return res.status(400).json({
        message: "Idempotency-Key must not exceed 100 characters.",
      });
    }

    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        message: "orderId is required.",
      });
    }

    const existingPayment = await prisma.payment.findUnique({
      where: {
        idempotencyKey,
      },
    });

    if (existingPayment) {
      return res.status(200).json(existingPayment);
    }

    const order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found.",
      });
    }

    if (!order.userId) {
      return res.status(400).json({
        message: "Order does not contain a userId.",
      });
    }

    if (
      order.totalPrice === undefined ||
      order.totalPrice === null ||
      Number(order.totalPrice) <= 0
    ) {
      return res.status(400).json({
        message: "Order has an invalid total price.",
      });
    }

    const amount = Math.round(Number(order.totalPrice) * 100);

    let payment;

    try {
      payment = await prisma.payment.create({
        data: {
          orderId,
          userId: order.userId,
          amount,
          currency: "INR",
          status: "creating",
          idempotencyKey,
        },
      });
    } catch (err) {
      if (err.code === "P2002") {
        const existing = await prisma.payment.findUnique({
          where: {
            idempotencyKey,
          },
        });

        if (existing) {
          return res.status(200).json(existing);
        }
      }

      throw err;
    }

    try {
      const razorpayOrder = await razorpay.orders.create({
        amount,
        currency: "INR",
        receipt: payment.id,
        notes: {
          orderId,
          paymentId: payment.id,
        },
      });

      payment = await prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "created",
          razorpayOrderId: razorpayOrder.id,
        },
      });

      return res.status(201).json({
        id: payment.id,
        orderId: payment.orderId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        idempotencyKey: payment.idempotencyKey,
        razorpayOrderId: payment.razorpayOrderId,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      });
    } catch (err) {
      await prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "failed",
        },
      });

      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function getPayment(req, res, next) {
  try {
    const payment = await prisma.payment.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found.",
      });
    }

    res.status(200).json(payment);
  } catch (err) {
    next(err);
  }
}

async function verifyPayment(req, res, next) {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        message:
          "razorpayOrderId, razorpayPaymentId and razorpaySignature are required.",
      });
    }

    const payment = await prisma.payment.findUnique({
      where: {
        razorpayOrderId,
      },
    });

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found.",
      });
    }

    if (payment.status === "paid") {
      return res.status(200).json({
        message: "Payment already verified.",
        payment,
      });
    }

    const isValid = verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValid) {
      await prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "failed",
        },
      });

      await notifyPaymentFailure(payment.orderId);

      return res.status(400).json({
        message: "Invalid payment signature.",
      });
    }

    const updatedPayment = await prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: "paid",
        razorpayPaymentId,
      },
    });

    await notifyPaymentSuccess(payment.orderId);

    return res.status(200).json({
      message: "Payment verified successfully.",
      payment: updatedPayment,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPayment,
  getPayment,
  verifyPayment,
};
