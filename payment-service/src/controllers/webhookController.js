const prisma = require("../config/prisma");

const {
  verifyWebhookSignature,
} = require("../services/paymentVerificationService");

const {
  notifyPaymentSuccess,
  notifyPaymentFailure,
} = require("../services/orderService");

async function handleWebhook(req, res, next) {
  try {
    const signature = req.get("X-Razorpay-Signature");

    if (!signature) {
      return res.status(400).json({
        message: "Missing Razorpay webhook signature.",
      });
    }

    const eventId =
      req.get("x-razorpay-event-id") || req.get("X-Razorpay-Event-Id");

    if (!eventId) {
      return res.status(400).json({
        message: "Missing Razorpay webhook event ID.",
      });
    }

    const rawBody = req.body;

    const isValid = verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      return res.status(400).json({
        message: "Invalid webhook signature.",
      });
    }

    const existingEvent = await prisma.webhookEvent.findUnique({
      where: {
        eventId,
      },
    });

    if (existingEvent) {
      return res.status(200).json({
        message: "Webhook already processed.",
      });
    }

    const payload = JSON.parse(rawBody.toString());

    const event = payload.event;

    await prisma.webhookEvent.create({
      data: {
        eventId,
        event,
      },
    });

    if (event === "payment.captured") {
      const paymentEntity = payload.payload?.payment?.entity;

      const razorpayOrderId = paymentEntity?.order_id;

      const razorpayPaymentId = paymentEntity?.id;

      if (!razorpayOrderId || !razorpayPaymentId) {
        return res.status(200).json({
          message: "Webhook received but payment data is incomplete.",
        });
      }

      const payment = await prisma.payment.findUnique({
        where: {
          razorpayOrderId,
        },
      });

      if (!payment) {
        return res.status(200).json({
          message: "Payment not found locally.",
        });
      }

      if (payment.status !== "paid") {
        await prisma.payment.update({
          where: {
            id: payment.id,
          },
          data: {
            status: "paid",
            razorpayPaymentId,
          },
        });
      }

      await notifyPaymentSuccess(payment.orderId);
    }

    if (event === "payment.failed" || event === "order.payment_failed") {
      const paymentEntity = payload.payload?.payment?.entity;

      const razorpayOrderId = paymentEntity?.order_id;

      if (razorpayOrderId) {
        const payment = await prisma.payment.findUnique({
          where: {
            razorpayOrderId,
          },
        });

        if (payment) {
          await prisma.payment.update({
            where: {
              id: payment.id,
            },
            data: {
              status: "failed",
            },
          });

          await notifyPaymentFailure(payment.orderId);
        }
      }
    }

    return res.status(200).json({
      message: "Webhook processed successfully.",
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleWebhook,
};
