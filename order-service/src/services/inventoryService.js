const axios = require("axios");

const INVENTORY_URL = process.env.INVENTORY_SERVICE_URL;

// Every call goes through here so failures look the same to the caller:
//  - inventory answered with an error (409 insufficient stock, 404, ...)
//      -> an Error carrying that same status and message
//  - inventory didn't answer at all (down, timeout)
//      -> an Error with status 503
// The saga needs this distinction: "inventory said NO" and "we don't know
// what happened" are handled differently.
async function call(path, body) {
  try {
    const response = await axios.post(`${INVENTORY_URL}${path}`, body, {
      timeout: 5000,
    });
    return response.data;
  } catch (err) {
    if (err.response) {
      const wrapped = new Error(
        err.response.data?.message || "Inventory service error",
      );
      wrapped.status = err.response.status;
      wrapped.productId = err.response.data?.productId;
      throw wrapped;
    }

    const unavailable = new Error("Inventory service unavailable");
    unavailable.status = 503;
    unavailable.unknownOutcome = true; // the request may or may not have landed
    throw unavailable;
  }
}

// items: [{ productId, quantity }, ...] — all reserved atomically.
function reserveStock(orderId, items) {
  return call("/api/inventory/reserve", { orderId, items });
}

function confirmReservation(orderId) {
  return call(`/api/inventory/confirm/${orderId}`, {});
}

function releaseReservation(orderId) {
  return call(`/api/inventory/release/${orderId}`, {});
}

module.exports = { reserveStock, confirmReservation, releaseReservation };
