const { redisClient } = require("../config/redis");

const { createNotification } = require("./notificationService");

const EVENT_STREAM = process.env.EVENT_STREAM || "order-events";

const CONSUMER_GROUP = process.env.CONSUMER_GROUP || "notification-group";

const CONSUMER_NAME = process.env.CONSUMER_NAME || "notification-worker-1";

const RETRY_STREAM = process.env.RETRY_STREAM || "order-events-retry";

const FAILED_STREAM = process.env.FAILED_STREAM || "order-events-failed";

const RETRY_CONSUMER_GROUP =
  process.env.RETRY_CONSUMER_GROUP || "notification-retry-group";

const RETRY_CONSUMER_NAME =
  process.env.RETRY_CONSUMER_NAME || "notification-retry-worker-1";

const MAX_RETRIES = Number(process.env.MAX_RETRIES) || 3;

/*
|--------------------------------------------------------------------------
| Consumer Groups
|--------------------------------------------------------------------------
*/

async function ensureConsumerGroup(stream, group) {
  try {
    await redisClient.xGroupCreate(stream, group, "0", {
      MKSTREAM: true,
    });

    console.log(`Created consumer group ${group} for ${stream}`);
  } catch (error) {
    if (!error.message.includes("BUSYGROUP")) {
      throw error;
    }

    console.log(`Consumer group ${group} already exists for ${stream}`);
  }
}

/*
|--------------------------------------------------------------------------
| Parse Event
|--------------------------------------------------------------------------
*/

function parseEvent(message) {
  return {
    eventId: message.eventId,
    eventType: message.eventType,
    aggregateType: message.aggregateType,
    aggregateId: message.aggregateId,
    payload: JSON.parse(message.payload),
    createdAt: message.createdAt,
  };
}

/*
|--------------------------------------------------------------------------
| Acknowledge
|--------------------------------------------------------------------------
*/

async function acknowledge(stream, group, messageId) {
  await redisClient.xAck(stream, group, messageId);
}

/*
|--------------------------------------------------------------------------
| Retry
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Failed Event
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Process Event
|--------------------------------------------------------------------------
*/

async function processEvent(stream, group, messageId, message) {
  const event = parseEvent(message);

  console.log(`Processing ${event.eventType} - ${event.eventId}`);

  try {
    await createNotification(event);

    await acknowledge(stream, group, messageId);

    console.log(`Acknowledged event ${event.eventId}`);
  } catch (error) {
    const currentAttempt = Number(message.attempt || 0) + 1;

    console.error(`Failed processing event ${event.eventId}: ${error.message}`);

    if (currentAttempt <= MAX_RETRIES) {
      await moveToRetry(event, currentAttempt);

      await acknowledge(stream, group, messageId);

      console.log(
        `Event ${event.eventId} scheduled for retry ${currentAttempt}/${MAX_RETRIES}`,
      );
    } else {
      await moveToFailed(event, currentAttempt, error);

      await acknowledge(stream, group, messageId);
    }
  }
}

/*
|--------------------------------------------------------------------------
| Main Event Stream
|--------------------------------------------------------------------------
*/

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
          await processEvent(
            EVENT_STREAM,
            CONSUMER_GROUP,
            message.id,
            message.message,
          );
        }
      }
    } catch (error) {
      console.error("Main event consumer error:", error.message);

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

/*
|--------------------------------------------------------------------------
| Retry Stream
|--------------------------------------------------------------------------
*/

async function consumeRetryStream() {
  while (true) {
    try {
      const result = await redisClient.xReadGroup(
        RETRY_CONSUMER_GROUP,
        RETRY_CONSUMER_NAME,
        [
          {
            key: RETRY_STREAM,
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
          await processEvent(
            RETRY_STREAM,
            RETRY_CONSUMER_GROUP,
            message.id,
            message.message,
          );
        }
      }
    } catch (error) {
      console.error("Retry consumer error:", error.message);

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

/*
|--------------------------------------------------------------------------
| Start Consumers
|--------------------------------------------------------------------------
*/

async function startEventConsumer() {
  await ensureConsumerGroup(EVENT_STREAM, CONSUMER_GROUP);

  await ensureConsumerGroup(RETRY_STREAM, RETRY_CONSUMER_GROUP);

  console.log("Notification consumer started.");

  console.log(`Main stream: ${EVENT_STREAM}`);

  console.log(`Main group: ${CONSUMER_GROUP}`);

  console.log(`Retry stream: ${RETRY_STREAM}`);

  console.log(`Retry group: ${RETRY_CONSUMER_GROUP}`);

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
