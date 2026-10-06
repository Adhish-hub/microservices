const express = require("express");

const {
  createPayment,
  getPayment,
  verifyPayment
} = require("../controllers/paymentController");

const router = express.Router();

router.post("/", createPayment);

router.post("/verify", verifyPayment);

router.get("/:id", getPayment);

module.exports = router;
