const { redisClient } = require("../config/redis");

const EVENT_STREAM = "order-events";

async function publishEvent(event) {
  if (!redisClient.isOpen) {
    throw new Error("Redis client is not connected.");
  }

  const message = {
    eventId: event.id,
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    payload: JSON.stringify(event.payload),
    createdAt: event.createdAt.toISOString(),
  };

  await redisClient.xAdd(EVENT_STREAM, "*", message);
}

module.exports = {
  EVENT_STREAM,
  publishEvent,
};
