const express = require("express");

const {
  getNotifications,
  markAsRead,
  markAllAsRead,
} = require("../controllers/notificationController");

const router = express.Router();

router.get("/user/:userId", getNotifications);

router.patch("/:id/read", markAsRead);

router.patch("/user/:userId/read-all", markAllAsRead);

module.exports = router;
