jest.mock("../src/services/notificationService", () => ({
  getUserNotifications: jest.fn(),
  markNotificationAsRead: jest.fn(),
  markAllNotificationsAsRead: jest.fn(),
}));

const notificationService = require("../src/services/notificationService");
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
} = require("../src/controllers/notificationController");

function makeResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("Notification controller", () => {
  beforeEach(() => jest.clearAllMocks());

  test("rejects notification retrieval without a user ID", async () => {
    const req = { headers: {} };
    const res = makeResponse();

    await getNotifications(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(notificationService.getUserNotifications).not.toHaveBeenCalled();
  });

  test("returns notifications for the authenticated user", async () => {
    const notifications = [{ id: "notification-1", message: "Order created" }];
    notificationService.getUserNotifications.mockResolvedValue(notifications);

    const req = { headers: { "x-user-id": "user-1" } };
    const res = makeResponse();

    await getNotifications(req, res, jest.fn());

    expect(notificationService.getUserNotifications).toHaveBeenCalledWith(
      "user-1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ notifications });
  });

  test("marks a notification as read", async () => {
    const notification = { id: "notification-1", read: true };
    notificationService.markNotificationAsRead.mockResolvedValue(notification);

    const req = {
      headers: { "x-user-id": "user-1" },
      params: { id: "notification-1" },
    };
    const res = makeResponse();

    await markAsRead(req, res, jest.fn());

    expect(notificationService.markNotificationAsRead).toHaveBeenCalledWith(
      "notification-1",
      "user-1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ notification });
  });

  test("marks all notifications as read", async () => {
    notificationService.markAllNotificationsAsRead.mockResolvedValue({
      count: 3,
    });

    const req = { headers: { "x-user-id": "user-1" } };
    const res = makeResponse();

    await markAllAsRead(req, res, jest.fn());

    expect(notificationService.markAllNotificationsAsRead).toHaveBeenCalledWith(
      "user-1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "All notifications mark as read.",
      count: 3,
    });
  });

  test("rejects mark-all-as-read without a user ID", async () => {
    const req = { headers: {} };
    const res = makeResponse();

    await markAllAsRead(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(
      notificationService.markAllNotificationsAsRead,
    ).not.toHaveBeenCalled();
  });
});
