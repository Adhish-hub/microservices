const prisma = require("../config/prisma");
const { publishEvent } = require("./eventBusService");

const PUBLISH_INTERVAL_MS = 5000;

async function publishPendingEvents() {
  const events = await prisma.outboxEvent.findMany({
    where: {
      status: "pending",
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 20,
  });

  for (const event of events) {
    try {
      await prisma.outboxEvent.update({
        where: {
          id: event.id,
        },
        data: {
          attempts: {
            increment: 1,
          },
        },
      });

      await publishEvent(event);

      await prisma.outboxEvent.update({
        where: {
          id: event.id,
        },
        data: {
          status: "published",
          publishedAt: new Date(),
        },
      });

      console.log(`Published event ${event.id} (${event.eventType})`);
    } catch (error) {
      console.error(`Failed to publish event ${event.id}:`, error.message);
    }
  }
}

function startOutboxPublisher() {
  publishPendingEvents().catch((error) => {
    console.error("Initial outbox publish failed:", error);
  });

  setInterval(() => {
    publishPendingEvents().catch((error) => {
      console.error("Outbox publisher error:", error);
    });
  }, PUBLISH_INTERVAL_MS);

  console.log(`Outbox publisher started. Interval: ${PUBLISH_INTERVAL_MS}ms`);
}

module.exports = {
  startOutboxPublisher,
};
