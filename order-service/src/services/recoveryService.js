const prisma = require("../config/prisma");
const { settleStaleOrder } = require("./orderSagaService");

// How old an order must be before we consider it stale.
//
// Development default: 1 minute.
// In production you would probably use something larger.
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

        if (result === "failed") {
          await prisma.order.update({
            where: {
              id: order.id,
            },
            data: {
              status: "failed",
            },
          });

          console.log(`Order ${order.id} marked as failed.`);
        }

        if (result === "confirmed") {
          await prisma.order.update({
            where: {
              id: order.id,
            },
            data: {
              status: "confirmed",
            },
          });

          console.log(`Order ${order.id} marked as confirmed.`);
        }

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
  recoverStaleOrders();

  // Then continue periodically.
  setInterval(recoverStaleOrders, RECOVERY_INTERVAL_MS);
}

module.exports = {
  recoverStaleOrders,
  startRecoveryWorker,
};
