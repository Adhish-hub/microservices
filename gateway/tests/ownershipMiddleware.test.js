const { requireParamOwnership } = require("../middlewares/ownershipMiddleware");

describe("ownershipMiddleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      params: {},
      user: undefined,
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    next = jest.fn();
  });

  test("should return 401 when user is not authenticated", () => {
    req.params.userId = "user-123";

    const middleware = requireParamOwnership("userId");

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);

    expect(res.json).toHaveBeenCalledWith({
      message: "Authentication required.",
    });

    expect(next).not.toHaveBeenCalled();
  });

  test("should return 403 when user does not own the resource", () => {
    req.user = {
      userId: "user-123",
      role: "customer",
    };

    req.params.userId = "user-456";

    const middleware = requireParamOwnership("userId");

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);

    expect(res.json).toHaveBeenCalledWith({
      message: "You do not have permission to access this resource.",
    });

    expect(next).not.toHaveBeenCalled();
  });

  test("should call next when user owns the resource", () => {
    req.user = {
      userId: "user-123",
      role: "customer",
    };

    req.params.userId = "user-123";

    const middleware = requireParamOwnership("userId");

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    expect(res.status).not.toHaveBeenCalled();
  });

  test("should support a custom route parameter", () => {
    req.user = {
      userId: "user-123",
      role: "customer",
    };

    req.params.ownerId = "user-123";

    const middleware = requireParamOwnership("ownerId");

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
