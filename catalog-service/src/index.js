require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const productRoutes = require("./routes/productRoutes");
const errorMiddleware = require("./middlewares/errorMiddleware");

const app = express();
const PORT = process.env.PORT || 4002;

connectDB();

app.use(express.json());

app.use("/api/products", productRoutes);

app.get("/health", (req, res) =>
  res.json({ status: "ok", service: "catalog-service" }),
);

app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`catalog-service listening on port ${PORT}`);
});
