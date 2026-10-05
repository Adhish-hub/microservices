const express = require("express");

const {register, login, verify} = require("../controllers/authController");

const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router()

router.post("/register", register);

router.post("/login", login);

router.get("/verify", authMiddleware, verify)

module.exports = router;