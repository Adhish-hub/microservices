const prisma = require("../config/prisma");

const {
  confirmReservation,
  releaseReservation,
} = require("./inventoryService");

const { createOutboxEvent } = require("./outboxService");

async function handlePaymentSuccess(orderId) {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
  });

  if (!order) {
    const error = new Error("Order not found.");
    error.status = 404;
    throw error;
  }

  if (order.status === "confirmed") {
    return order;
  }

  if (order.status === "failed") {
    const error = new Error("Cannot confirm payment for a failed order.");

    error.status = 409;
    throw error;
  }

  await confirmReservation(orderId);

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const confirmedOrder = await tx.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: "confirmed",
      },
      include: {
        items: true,
      },
    });

    await createOutboxEvent(tx, {
      eventType: "order.confirmed",
      aggregateType: "Order",
      aggregateId: confirmedOrder.id,
      payload: {
        orderId: confirmedOrder.id,
        userId: confirmedOrder.userId,
        totalPrice: confirmedOrder.totalPrice,
        status: confirmedOrder.status,
        items: confirmedOrder.items,
      },
    });

    return confirmedOrder;
  });

  return updatedOrder;
}

async function handlePaymentFailure(orderId) {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
  });

  if (!order) {
    const error = new Error("Order not found.");
    error.status = 404;
    throw error;
  }

  if (order.status === "failed") {
    return order;
  }

  if (order.status === "confirmed") {
    const error = new Error("Cannot fail an already confirmed order.");

    error.status = 409;
    throw error;
  }

  await releaseReservation(orderId);

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const failedOrder = await tx.order.update({
      where: {
        id: orderId,
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
        reason: "payment_failed",
        items: failedOrder.items,
      },
    });

    return failedOrder;
  });

  return updatedOrder;
}

module.exports = {
  handlePaymentSuccess,
  handlePaymentFailure,
};
