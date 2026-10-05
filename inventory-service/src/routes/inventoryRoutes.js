const express = require("express");

const {upperStock, getStock,getReservation, reserveStock, confirmReservation, releaseReservation} = require("../controllers/inventoryController");

const router = express.Router();

router.post("/stock", upperStock);

router.get("/stock/:productId", getStock);

router.get("/reservations/:orderId", getReservation);

router.post("/reserve", reserveStock);

router.post("/confirm/:orderId", confirmReservation);

router.post("/confirm/:orderId", releaseReservation);

module.exports = router;