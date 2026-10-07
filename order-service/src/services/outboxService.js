const prisma = require("../config/prisma");

async function createOutboxEvent(
  tx,
  {
    eventType,
    aggregateType,
    aggregateId,
    payload,
  },
) {
  return tx.outboxEvent.create({
    data: {
      eventType,
      aggregateType,
      aggregateId,
      payload,
    },
  });
}

module.exports = {
  createOutboxEvent,
};

