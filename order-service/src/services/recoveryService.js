const prisma = require("../config/prisma");
const { settleStaleOrder } = require("./sagaHelpers");

// How old an order must be before we consider it stale.
//
// Development default: 1 minute.
// In production you would probably use something larger.

const { createOutboxEvent } = require("./outboxService");


const STALE_ORDER_MINUTES = Number(process.env.STALE_ORDER_MINUTES || 1);

// How often the recovery process runs.
//
// Development default: every 30 seconds.
const RECOVERY_INTERVAL_MS = Number(process.env.RECOVERY_INTERVAL_MS || 30000);

let recoveryRunning = false;

async function recoverStaleOrders() {
  // Prevent two recovery runs from overlapping.
  if (recoveryRunning) {
    return;
  }

  recoveryRunning = true;

  try {
    const staleBefore = new Date(Date.now() - STALE_ORDER_MINUTES * 60 * 1000);

    // Find orders that have remained pending for too long.
    const orders = await prisma.order.findMany({
      where: {
        status: "pending",
        createdAt: {
          lt: staleBefore,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 50,
    });

    if (orders.length === 0) {
      return;
    }

    console.log(`Recovery found ${orders.length} stale pending order(s).`);

    for (const order of orders) {
      try {
        console.log(`Recovering stale order ${order.id}...`);

        const result = await settleStaleOrder(order.id);

          /*
         * Inventory confirms that there is no active reservation.
         *
         * Therefore the order failed.
         */
        if (result === "failed") {
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

            /*
             * IMPORTANT:
             *
             * Recovery-generated state changes must also
             * produce events.
             */
            await createOutboxEvent(tx, {
              eventType: "order.failed",
              aggregateType: "Order",
              aggregateId: failedOrder.id,

              payload: {
                orderId: failedOrder.id,
                userId: failedOrder.userId,
                totalPrice: failedOrder.totalPrice,
                status: failedOrder.status,
                reason: "stale_order_recovery",
                items: failedOrder.items,
              },
            });
          });

          console.log(
            `Order ${order.id} marked as failed by recovery.`,
          );

          continue;
        }

        /*
         * Inventory says the reservation was already confirmed.
         *
         * That means payment/order completion happened,
         * but Order Service lost its final database update.
         *
         * We therefore roll FORWARD to confirmed.
         */

        if (result === "confirmed") {
          await prisma.$transaction(async (tx) => {
            const confirmedOrder = await tx.order.update({
              where: {
                id: order.id,
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
          });

          console.log(
            `Order ${order.id} marked as confirmed by recovery.`,
          );

          continue;
        }

        /*
         * Inventory could not be reached.
         *
         * Leave the order pending so the next recovery
         * cycle can try again.
         */
        if (result === "retry") {
          console.log(
            `Order ${order.id} could not be recovered. Will retry later.`,
          );
        }
      } catch (err) {
        // One broken order should NOT stop recovery of every
        // other stale order.
        console.error(`Recovery failed for order ${order.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("Stale order recovery failed:", err.message);
  } finally {
    recoveryRunning = false;
  }
}

function startRecoveryWorker() {
  console.log(
    `Order recovery worker started. Checking every ${
      RECOVERY_INTERVAL_MS / 1000
    } seconds.`,
  );

  console.log(
    `Orders older than ${STALE_ORDER_MINUTES} minute(s) will be recovered.`,
  );

  // Run once immediately when the service starts.
  recoverStaleOrders().catch((error) => {
    console.error(
      "Initial order recovery failed:",
      error,
    );
  });

  // Then continue periodically.
  setInterval(() => {
    recoverStaleOrders().catch((error) => {
      console.error(
        "Order recovery worker error:",
        error,
      );
    });
  }, RECOVERY_INTERVAL_MS);
}

module.exports = {
  recoverStaleOrders,
  startRecoveryWorker,
};
