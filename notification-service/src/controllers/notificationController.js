const notificationService = require("../services/notificationService");

async function getNotifications(req, res, next){
    try{
        const notifications = await notificationService.getUserNotifications(
            req.params.userId,
        );

        res.status(200).json({
            notifications,
        });
    }catch(error){
        next(error);
    }
}

async function markAsRead(req, res, next){
    try{
        const notification = await notificationService.markNotificationsAsRead(
            req.params.id,
        );

        res.status(200).json({
            notification,
        });
    }catch(error){
        next(error);
    }
}

async function markAllAsRead(req, res, next){
    try{
        const result = await notificationService.markAllNotificationsAsRead(
            req.params.userId,
        );

        res.status(200).json({
            message: "All notifications mark as read.",
            count: result.count,
        });
    }catch(error){
        next(error);
    }
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
};