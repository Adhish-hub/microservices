jest.mock("../middlewares/resilientProxy", () => ({
  createResilientProxy: jest.fn(() => [
    (req, res, next) => next(),
    (req, res, next) => next(),
  ]),
}));

const request = require("supertest");

const app = require("../app");

const { verifyToken } = require("../utils/token");

jest.mock("../utils/token");

describe("Gateway API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /health", () => {
    test("should return gateway health status", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        status: "ok",
        service: "gateway",
      });
    });
  });

  describe("Protected routes", () => {
    test("should reject an order request without authentication", async () => {
      const response = await request(app).get("/api/orders/test-order");

      expect(response.status).toBe(401);

      expect(response.body).toEqual({
        message: "Authentication required.",
      });
    });

    test("should reject a notification request without authentication", async () => {
      const response = await request(app).get("/api/notifications/user-123");

      expect(response.status).toBe(401);

      expect(response.body).toEqual({
        message: "Authentication required.",
      });
    });

    test("should reject a payment request without authentication", async () => {
      const response = await request(app).get("/api/payments/test-payment");

      expect(response.status).toBe(401);

      expect(response.body).toEqual({
        message: "Authentication required.",
      });
    });

    test("should reject a cart request without authentication", async () => {
      const response = await request(app).get("/api/cart/user-123");

      expect(response.status).toBe(401);

      expect(response.body).toEqual({
        message: "Authentication required.",
      });
    });
  });

  describe("Protected routes with invalid tokens", () => {
    test("should reject an invalid token", async () => {
      verifyToken.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      const response = await request(app)
        .get("/api/orders/test-order")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);

      expect(response.body).toEqual({
        message: "Invalid or expired token.",
      });

      expect(verifyToken).toHaveBeenCalledWith("invalid-token");
    });
  });

  describe("Cart ownership", () => {
    test("should reject access to another user's cart", async () => {
      verifyToken.mockReturnValue({
        userId: "user-123",
        role: "customer",
      });

      const response = await request(app)
        .get("/api/cart/user-456")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(403);

      expect(response.body).toEqual({
        message: "You do not have permission to access this resource.",
      });
    });

    test("should allow access when user owns the cart", async () => {
      verifyToken.mockReturnValue({
        userId: "user-123",
        role: "customer",
      });

      const response = await request(app)
        .get("/api/cart/user-123")
        .set("Authorization", "Bearer valid-token");

      /*
       * Authentication and ownership should succeed.
       *
       * The request then reaches the Cart Service proxy.
       * Since the test does not run the Cart Service,
       * we only verify that it passed the Gateway security layer.
       */

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);

      expect(verifyToken).toHaveBeenCalledWith("valid-token");
    });
  });

  describe("Catalog role protection", () => {
    test("should reject customer from creating a product", async () => {
      verifyToken.mockReturnValue({
        userId: "user-123",
        role: "customer",
      });

      const response = await request(app)
        .post("/api/products")
        .set("Authorization", "Bearer customer-token");

      expect(response.status).toBe(403);

      expect(response.body).toEqual({
        message: "You do not have permission to perform this action.",
      });
    });

    test("should reject customer from deleting a product", async () => {
      verifyToken.mockReturnValue({
        userId: "user-123",
        role: "customer",
      });

      const response = await request(app)
        .delete("/api/products/product-123")
        .set("Authorization", "Bearer customer-token");

      expect(response.status).toBe(403);

      expect(response.body).toEqual({
        message: "You do not have permission to perform this action.",
      });
    });
  });
});
