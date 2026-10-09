const notificationService = require("../services/notificationService");

async function getNotifications(req, res, next){
    try{
        const userId = req.headers["x-user-id"];

        if(!userId){
            return res.status(401).json({
                message: "Authenticated user ID is missing."
            });
        }

        const notifications = await notificationService.getUserNotifications(userId);

        res.status(200).json({
            notifications,
        })
    }catch(error){
        next(error);
    }
}

async function markAsRead(req, res, next){
    try{
        const userId = req.headers["x-user-id"];

        if(!userId){
            return res.status(401).json({
                message: "Authenticated user ID is missing.",
            });
        }

        const notification = await notificationService.markNotificationAsRead(
            req.params.id,
            userId,
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
        const userId = req.headers["x-user-id"];

        if(!userId){
            return res.status(401).json({
                message: "Authenticated user ID is missing.",
            });
        }

        const result = await notificationService.markAllNotificationsAsRead(userId);

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