const { createClient } = require("redis");

const redisUrl = process.env.REDIS_URL || "redis://event-redis:6379";

const redisClient = createClient({
  url: redisUrl,
});

redisClient.on("error", (error) => {
  console.error("Redis error:", error);
});

async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  console.log("Redis connected");
}

module.exports = {
  redisClient,
  connectRedis,
};