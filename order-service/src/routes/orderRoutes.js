const express = require("express");
const { createOrder, getOrder, paymentFailure, paymentSuccess } = require("../controllers/orderController");

const router = express.Router();

router.post("/", createOrder);
router.get("/:id", getOrder);

router.post("/:id/payment-success", paymentSuccess);

router.post("/:id/payment-failed", paymentFailure);

module.exports = router;
