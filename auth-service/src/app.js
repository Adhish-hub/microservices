const express = require("express");

const authRoutes = require("./routes/authRoutes");
const errorMiddleware = require("./middlewares/errorMiddleware");

const app = express();

app.use(express.json());

app.use("/api/auth", authRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "auth-service",
  });
});

app.use(errorMiddleware);

module.exports = app;
