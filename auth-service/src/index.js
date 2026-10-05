require("dotenv").config();

const express = require("express");
const authRoutes = require("./routes/authRoutes");
const errorMiddleware = require("./middlewares/errorMiddleware");

const app = express();

const PORT = process.env.PORT || 4001;

app.use(express.json());

app.use("/api/auth", authRoutes);

app.get("/health", (req, res) => res.json({
    status: "ok",
    service: "auth-service"
}));

app.use(errorMiddleware);

app.listen(PORT, () => {
    console.log(`Auth-service listening on port ${PORT}`)
});