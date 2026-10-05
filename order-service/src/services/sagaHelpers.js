const prisma = require("../config/prisma");

const inventoryService = require("./inventoryService");

// The saga's "undo" for stock, used while handling a failed request:
// give the reservation back.
//  - 404 means "there was never a reservation for this order" — which is
//    exactly the state we want, so it counts as success.
//  - Any other failure is logged, not thrown. We're already handling a
//    failure; the recovery sweeper retries later because release is
//    idempotent and the order is left for it to find.
async function safeRelease(orderId) {
  try {
    await inventoryService.releaseReservation(orderId);
    return true;
  } catch (err) {
    if (err.status === 404) return true;

    console.error(
      `Could not release reservation for order ${orderId}:`,
      err.message,
    );
    return false;
  }
}

async function markFailed(orderId) {
  return prisma.order.update({
    where: { id: orderId },
    data: { status: "failed" },
  });
}

// Used by the recovery sweeper on an order stuck in `pending` — a crash
// happened somewhere between "order saved" and "order confirmed". We don't
// know how far it got, so we ask inventory to release and read the answer:
//
//   release OK / 404  -> stock is back on sale (or never held): order failed
//   release 409       -> inventory says the reservation was already CONFIRMED,
//                        so the sale actually completed; only our own final
//                        status update was lost. Roll FORWARD to confirmed.
//   anything else     -> inventory unreachable; try again next sweep
async function settleStaleOrder(orderId) {
  try {
    await inventoryService.releaseReservation(orderId);
    return "failed";
  } catch (err) {
    if (err.status === 404) return "failed";
    if (err.status === 409) return "confirmed";
    return "retry";
  }
}

module.exports = { safeRelease, markFailed, settleStaleOrder };
