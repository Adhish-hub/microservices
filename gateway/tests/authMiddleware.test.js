const authMiddleware = require("../middlewares/authMiddleware");

const {verifyToken} = require("../utils/token");

jest.mock("../utils/token");

describe("authMiddleware", () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = {
            headers: {},
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        next = jest.fn();

        jest.clearAllMocks();
    });

    test("should return 401 when Authorization header is missing", () => {
        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);

        expect(res.json).toHaveBeenCalledWith({
            message: "Authentication required.",
        });

        expect(next).not.toHaveBeenCalled();
    });

    test("should return 401 when Authorization header is malformed", () => {
        req.headers.authorization = "basic abc123";

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);

        expect(res.json).toHaveBeenCalledWith({
            message: "Authentication required.",
        });

        expect(next).not.toHaveBeenCalled();
    });

    test("should return 401 when Bearer token is missing", () => {
        req.headers.authorization = "Bearer ";

        authMiddleware(req, res,next);

        expect(res.status).toHaveBeenCalledWith(401);

        expect(res.json).toHaveBeenCalledWith({
            message: "Authentication token is missing.",
        });

        expect(next).not.toHaveBeenCalled();
    });

    test("should return 401 whentoken is invalid", () => {
        req.headers.authorization = "Bearer invalid-token";

        verifyToken.mockImplementation(() => {
            throw new Error("Invalid token.");
        });

        authMiddleware(req, res, next);

        expect(verifyToken).toHaveBeenCalledWith("invalid-token");

        expect(res.status).toHaveBeenCalledWith(401);

        expect(res.json).toHaveBeenCalledWith({
            message: "Invalid or expired token.",
        });

        expect(next).not.toHaveBeenCalled();
    });

    test("should attch decoded user and call next when token is valid", () => {
        req.headers.authorization = "Bearer valid-token";

        const decodedUser = {
            userId: "user-123",
            role: "customer",
        };

        verifyToken.mockReturnValue(decodedUser);

        authMiddleware(req, res, next);

        expect(verifyToken).toHaveBeenCalledWith("valid-token");

        expect(req.user).toEqual(decodedUser);

        expect(next).toHaveBeenCalledTimes(1);

        expect(res.status).not.toHaveBeenCalled();
    });
});