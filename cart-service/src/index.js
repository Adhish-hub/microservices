require("dotenv").config();
const express = require("express");
const { connectRedis } = require("./config/redis");
const cartRoutes = require("./routes/cartRoutes");
const errorMiddleware = require("./middlewares/errorMiddleware");

const app = express();
const PORT = process.env.PORT || 4003;

connectRedis();

app.use(express.json());

app.use("/api/cart", cartRoutes);

app.get("/health", (req, res) =>
  res.json({ status: "ok", service: "cart-service" }),
);

app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`cart-service listening on port ${PORT}`);
});
