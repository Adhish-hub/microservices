require("dotenv").config();

const express = require("express");

const notificationRoutes = require("./routes/notificationRoutes");

const { connectRedis } = require("./config/redis");

const { startEventConsumer } = require("./services/eventConsumer");

const errorMiddleware = require("./middlewares/errorMiddleware");

const app = express();

const PORT = process.env.PORT || 4007;

app.use(express.json());

app.use("/api/notifications", notificationRoutes);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "notification-service",
  });
});

app.use(errorMiddleware);

async function startServer() {
  try {
    await connectRedis();

    await startEventConsumer();

    app.listen(PORT, () => {
      console.log(`notification-service listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start notification-service:", error);

    process.exit(1);
  }
}

startServer();
