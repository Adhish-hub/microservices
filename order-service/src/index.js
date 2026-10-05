require("dotenv").config();
const express = require("express");
const orderRoutes = require("./routes/orderRoutes");
const errorMiddleware = require("./middlewares/errorMiddleware");

const app = express();
const PORT = process.env.PORT || 4005;

app.use(express.json());

app.use("/api/orders", orderRoutes);

app.get("/health", (req, res) =>
  res.json({ status: "ok", service: "order-service" }),
);

app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`order-service listening on port ${PORT}`);
});
