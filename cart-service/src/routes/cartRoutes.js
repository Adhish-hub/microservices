const express = require("express");

const { getCart, addItem, removeItem, clearCart } = require("../controllers/cartController");

const router = express.Router();

router.get("/:userId", getCart);

router.post("/:userId/items", addItem);

router.delete("/:userId/items/:productId", removeItem);

router.delete("/:userId", clearCart);

module.exports = router;