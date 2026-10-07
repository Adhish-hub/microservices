const { redisClient } = require("../config/redis");

const { createNotification } = require("./notificationService");

const EVENT_STREAM = process.env.EVENT_STREAM || "order-events";

const CONSUMER_GROUP = process.env.CONSUMER_GROUP || "notification-group";

const CONSUMER_NAME = process.env.CONSUMER_NAME || "notification-worker-1";

const RETRY_STREAM = process.env.RETRY_STREAM || "order-events-retry";

const FAILED_STREAM = process.env.FAILED_STREAM || "order-events-failed";

const MAX_RETRIES = Number(process.env.MAX_RETRIES) || 3;

async function ensureConsumerGroup() {
  try {
    await redisClient.xGroupCreate(EVENT_STREAM, CONSUMER_GROUP, "0", {
      MKSTREAM: true,
    });

    console.log(`Created consumer group ${CONSUMER_GROUP}`);
  } catch (error) {
    if (!error.message.includes("BUSYGROUP")) {
      throw error;
    }

    console.log(`Consumer group ${CONSUMER_GROUP} already exists`);
  }
}

function parseEvent(message) {
  const event = {
    eventId: message.eventId,
    eventType: message.eventType,
    aggregateType: message.aggregateType,
    aggregateId: message.aggregateId,
    payload: JSON.parse(message.payload),
    createdAt: message.createdAt,
  };

  return event;
}

async function acknowledge(stream, messageId) {
  await redisClient.xAck(stream, CONSUMER_GROUP, messageId);
}

async function moveToRetry(event, attempt) {
  await redisClient.xAdd(RETRY_STREAM, "*", {
    eventId: event.eventId,
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    payload: JSON.stringify(event.payload),
    createdAt: event.createdAt,
    attempt: String(attempt),
  });
}

async function moveToFailed(event, attempt, error) {
  await redisClient.xAdd(FAILED_STREAM, "*", {
    eventId: event.eventId,
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    payload: JSON.stringify(event.payload),
    createdAt: event.createdAt,
    attempts: String(attempt),
    error: error.message,
  });

  console.error(
    `Event ${event.eventId} moved to failed stream after ${attempt} attempts.`,
  );
}

async function processEvent(stream, messageId, message) {
  const event = parseEvent(message);

  console.log(`Processing ${event.eventType} - ${event.eventId}`);

  try {
    await createNotification(event);

    await acknowledge(stream, messageId);

    console.log(`Acknowledged event ${event.eventId}`);
  } catch (error) {
    const currentAttempt = Number(message.attempt || 0) + 1;

    console.error(`Failed processing event ${event.eventId}: ${error.message}`);

    if (currentAttempt <= MAX_RETRIES) {
      await moveToRetry(event, currentAttempt);

      await acknowledge(stream, messageId);

      console.log(
        `Event ${event.eventId} scheduled for retry ${currentAttempt}/${MAX_RETRIES}`,
      );
    } else {
      await moveToFailed(event, currentAttempt, error);

      await acknowledge(stream, messageId);
    }
  }
}

async function consumeMainStream() {
  while (true) {
    try {
      const result = await redisClient.xReadGroup(
        CONSUMER_GROUP,
        CONSUMER_NAME,
        [
          {
            key: EVENT_STREAM,
            id: ">",
          },
        ],
        {
          COUNT: 10,
          BLOCK: 5000,
        },
      );

      if (!result) {
        continue;
      }

      for (const stream of result) {
        for (const message of stream.messages) {
          await processEvent(EVENT_STREAM, message.id, message.message);
        }
      }
    } catch (error) {
      console.error("Main event consumer error:", error.message);

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

async function consumeRetryStream() {
  while (true) {
    try {
      const result = await redisClient.xRead(
        [
          {
            key: RETRY_STREAM,
            id: "$",
          },
        ],
        {
          COUNT: 10,
          BLOCK: 5000,
        },
      );

      if (!result) {
        continue;
      }

      for (const stream of result) {
        for (const message of stream.messages) {
          await processEvent(RETRY_STREAM, message.id, message.message);
        }
      }
    } catch (error) {
      console.error("Retry consumer error:", error.message);

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

async function startEventConsumer() {
  await ensureConsumerGroup();

  console.log(`Notification consumer started.`);

  console.log(`Stream: ${EVENT_STREAM}`);

  console.log(`Group: ${CONSUMER_GROUP}`);

  consumeMainStream().catch((error) => {
    console.error("Main consumer stopped:", error);
  });

  consumeRetryStream().catch((error) => {
    console.error("Retry consumer stopped:", error);
  });
}

module.exports = {
  startEventConsumer,
};
