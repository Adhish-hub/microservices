const prisma = require("../config/prisma");

async function createNotification(event) {
  const payload = event.payload;

  if (!payload || !payload.userId) {
    throw new Error("Event payload does not contain user ID.");
  }

  let message;

  switch (event.eventType) {
    case "order.created":
      message = `Your order ${payload.orderId} has been created.`;
      break;

    case "order.confirmed":
      message = `Your order ${payload.orderId} has been confirmed.`;
      break;

    case "order.failed":
      message = `Your order ${payload.orderId} has failed.`;
      break;

    default:
      return null;
  }

  try {
    const notification = await prisma.notification.create({
      data: {
        eventId: event.eventId,
        userId: payload.userId,
        type: event.eventType,
        message,
      },
    });

    console.log(`Notification created for event ${event.eventId}`);

    return notification;
  } catch (error) {
    if (error.code === "P2002") {
      console.log(
        `Event ${event.eventId} already processed. Skipping duplicate.`,
      );

      return null;
    }

    throw error;
  }
}

async function getUserNotifications(userId) {
  return prisma.notification.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

async function markNotificationAsRead(id, userId) {

  const notification = await prisma.notification.findFirst({
    where: {
      id,
      userId,
    },
  });

  if(!notification){
    const error = new Error("Notification not found.");
    error.status = 404;
    throw error;
  }

  return prisma.notification.update({
    where: {
      id,
    },
    data: {
      isRead: true,
    },
  });
}

async function markAllNotificationsAsRead(userId) {
  return prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });
}

module.exports = {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
