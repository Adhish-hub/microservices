const axios = require("axios");

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL;

async function getOrderById(orderId) {
  try {
    const response = await axios.get(
      `${ORDER_SERVICE_URL}/api/orders/${encodeURIComponent(orderId)}`,
      {
        timeout: 3000,
      },
    );

    return response.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      const error = new Error("Order not found.");
      error.status = 404;
      throw error;
    }

    if (err.response) {
      const error = new Error(
        err.response.data?.message || "Order service error",
      );

      error.status = err.response.status;
      throw error;
    }

    const error = new Error("Order service unavailable.");
    error.status = 503;

    throw error;
  }
}

async function notifyPaymentSuccess(orderId) {
  try {
    const response = await axios.post(
      `${ORDER_SERVICE_URL}/api/orders/${encodeURIComponent(orderId)}/payment-success`,
      {},
      {
        timeout: 5000,
      },
    );

    return response.data;
  } catch (err) {
    if (err.response) {
      const error = new Error(
        err.response.data?.message || "Order payment-success update failed.",
      );

      error.status = err.response.status;
      throw error;
    }

    const error = new Error("Order service unavailable.");
    error.status = 503;

    throw error;
  }
}

async function notifyPaymentFailure(orderId) {
  try {
    const response = await axios.post(
      `${ORDER_SERVICE_URL}/api/orders/${encodeURIComponent(orderId)}/payment-failed`,
      {},
      {
        timeout: 5000,
      },
    );

    return response.data;
  } catch (err) {
    if (err.response) {
      const error = new Error(
        err.response.data?.message || "Order payment-failed update failed.",
      );

      error.status = err.response.status;
      throw error;
    }

    const error = new Error("Order service unavailable.");
    error.status = 503;

    throw error;
  }
}

module.exports = {
  getOrderById,
  notifyPaymentSuccess,
  notifyPaymentFailure,
};
