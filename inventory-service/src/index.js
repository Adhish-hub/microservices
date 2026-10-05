require("dotenv").config();
const express = require("express");
const inventoryRoutes = require("./routes/inventoryRoutes");
const errorMiddleware = require("./middlewares/errorMiddleware");

const app = express();
const PORT = process.env.PORT || 4004;

app.use(express.json());

app.use("/api/inventory", inventoryRoutes);

app.get("/health", (req, res) =>
  res.json({ status: "ok", service: "inventory-service" }),
);

app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`inventory-service listening on port ${PORT}`);
});
