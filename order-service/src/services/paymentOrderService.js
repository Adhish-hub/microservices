const prisma = require("../config/prisma");

const {
  confirmReservation,
  releaseReservation,
} = require("./inventoryService");

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

  const updatedOrder = await prisma.order.update({
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

  const updatedOrder = await prisma.order.update({
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

  return updatedOrder;
}

module.exports = {
  handlePaymentSuccess,
  handlePaymentFailure,
};
