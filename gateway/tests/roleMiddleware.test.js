const authorizeRoles = require("../middlewares/roleMiddleware");

describe("roleMiddleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      user: undefined,
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    next = jest.fn();
  });

  test("should return 401 when user is not authenticated", () => {
    const middleware = authorizeRoles("admin");

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);

    expect(res.json).toHaveBeenCalledWith({
      message: "Authentication required.",
    });

    expect(next).not.toHaveBeenCalled();
  });

  test("should return 403 when user role is not allowed", () => {
    req.user = {
      userId: "user-123",
      role: "customer",
    };

    const middleware = authorizeRoles("admin");

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);

    expect(res.json).toHaveBeenCalledWith({
      message: "You do not have permission to perform this action.",
    });

    expect(next).not.toHaveBeenCalled();
  });

  test("should call next when user has an allowed role", () => {
    req.user = {
      userId: "user-123",
      role: "admin",
    };

    const middleware = authorizeRoles("admin");

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    expect(res.status).not.toHaveBeenCalled();
  });

  test("should allow any one of multiple permitted roles", () => {
    req.user = {
      userId: "user-123",
      role: "seller",
    };

    const middleware = authorizeRoles("seller", "admin");

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    expect(res.status).not.toHaveBeenCalled();
  });
});
