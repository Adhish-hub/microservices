require("dotenv").config();

const express = require("express");

const paymentRoutes = require("./src/routes/paymentRoutes");
const webhookRoutes = require("./src/routes/webhookRoutes");
const errorMiddleware = require("./src/middlewares/errorMiddleware");

const prisma = require("./src/config/prisma");

const app = express();

const PORT = process.env.PORT || 4006;

/*
 * Webhook MUST come before express.json().
 *
 * Razorpay signature verification requires
 * the original raw request body.
 */
app.use(
  "/api/payments/webhook",
  express.raw({
    type: "application/json",
  }),
  webhookRoutes,
);

app.use(express.json());

app.use("/api/payments", paymentRoutes);

app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    service: "payment-service",
  }),
);

app.use(errorMiddleware);

async function startServer() {
  try {
    await prisma.$connect();

    console.log("Payment database connected.");

    app.listen(PORT, () => {
      console.log(`payment-service listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Payment database connection failed:", err);

    process.exit(1);
  }
}

startServer();
