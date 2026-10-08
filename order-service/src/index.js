require("dotenv").config();

const express = require("express");

const orderRoutes = require("./routes/orderRoutes");
const errorMiddleware = require("./middlewares/errorMiddleware");

const { connectRedis } = require("./config/redis");
const { startOutboxPublisher } = require("./services/outboxPublisher");

const { startRecoveryWorker } = require("./services/recoveryService");

const app = express();

const PORT = process.env.PORT || 4005;

app.use(express.json());

app.use("/api/orders", orderRoutes);

app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    service: "order-service",
  }),
);

app.use(errorMiddleware);

async function startServer() {
  try {
    await connectRedis();

    /*
     * Reliable event publishing.
     */

    startOutboxPublisher();

    /*
     * Recover orders that were interrupted by
     * crashes, timeouts, or service failures.
     */

    startRecoveryWorker()

    app.listen(PORT, () => {
      console.log(`order-service listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start order-service:", error);

    process.exit(1);
  }
}

startServer();
