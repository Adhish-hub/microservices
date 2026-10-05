const { createClient } = require("redis");

const redisClient = createClient({
    url: process.env.REDIS_URL,
});

redisClient.on("error", (err) => console.error("Redis error:", err));

async function connectRedis(){
    await redisClient.connect();
    console.log("Cart-service connected to Redis.")
}

module.exports = {redisClient, connectRedis}