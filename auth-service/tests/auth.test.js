jest.mock("../src/config/prisma", () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("../src/utils/hash", () => ({
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
}));

jest.mock("../src/utils/token", () => ({
  signToken: jest.fn(),
  verifyToken: jest.fn(),
}));

const request = require("supertest");
const app = require("../src/app");

const prisma = require("../src/config/prisma");
const { hashPassword, comparePassword } = require("../src/utils/hash");
const { signToken, verifyToken } = require("../src/utils/token");

describe("Auth Service API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /health", () => {
    test("returns the Auth Service health status", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: "ok",
        service: "auth-service",
      });
    });
  });

  describe("POST /api/auth/register", () => {
    test("rejects registration when email or password is missing", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({ email: "customer@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Email and password are required.");
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    test("rejects an email that is already registered", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-existing",
        email: "customer@example.com",
      });

      const response = await request(app).post("/api/auth/register").send({
        email: "customer@example.com",
        password: "Password123!",
      });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe("Email already registered.");
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    test("registers a user and returns a token", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      hashPassword.mockResolvedValue("hashed-password");

      prisma.user.create.mockResolvedValue({
        id: "user-123",
        email: "customer@example.com",
        role: "customer",
      });

      signToken.mockReturnValue("test-jwt-token");

      const response = await request(app).post("/api/auth/register").send({
        email: "customer@example.com",
        password: "Password123!",
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        user: {
          id: "user-123",
          email: "customer@example.com",
          role: "customer",
        },
        token: "test-jwt-token",
      });

      expect(hashPassword).toHaveBeenCalledWith("Password123!");

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: "customer@example.com",
          passwordHash: "hashed-password",
        },
      });

      expect(signToken).toHaveBeenCalledWith({
        userId: "user-123",
        role: "customer",
      });
    });
  });

  describe("POST /api/auth/login", () => {
    test("rejects login when email or password is missing", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "customer@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Email and password are required.");
    });

    test("rejects an email that does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app).post("/api/auth/login").send({
        email: "unknown@example.com",
        password: "Password123!",
      });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid email or password.");
      expect(comparePassword).not.toHaveBeenCalled();
    });

    test("rejects an incorrect password", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        email: "customer@example.com",
        passwordHash: "stored-hash",
        role: "customer",
      });

      comparePassword.mockResolvedValue(false);

      const response = await request(app).post("/api/auth/login").send({
        email: "customer@example.com",
        password: "WrongPassword!",
      });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid email or password.");
      expect(signToken).not.toHaveBeenCalled();
    });

    test("logs in successfully and returns a token", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        email: "customer@example.com",
        passwordHash: "stored-hash",
        role: "customer",
      });

      comparePassword.mockResolvedValue(true);
      signToken.mockReturnValue("test-jwt-token");

      const response = await request(app).post("/api/auth/login").send({
        email: "customer@example.com",
        password: "Password123!",
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: {
          id: "user-123",
          email: "customer@example.com",
          role: "customer",
        },
        token: "test-jwt-token",
      });

      expect(comparePassword).toHaveBeenCalledWith(
        "Password123!",
        "stored-hash",
      );

      expect(signToken).toHaveBeenCalledWith({
        userId: "user-123",
        role: "customer",
      });
    });
  });

  describe("GET /api/auth/verify", () => {
    test("rejects a request without a Bearer token", async () => {
      const response = await request(app).get("/api/auth/verify");

      expect(response.status).toBe(401);
      expect(verifyToken).not.toHaveBeenCalled();
    });

    test("rejects an invalid token", async () => {
      verifyToken.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      const response = await request(app)
        .get("/api/auth/verify")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid or expired token.");
    });

    test("verifies a valid token and returns the user payload", async () => {
      verifyToken.mockReturnValue({
        userId: "user-123",
        role: "customer",
      });

      const response = await request(app)
        .get("/api/auth/verify")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        valid: true,
        user: {
          userId: "user-123",
          role: "customer",
        },
      });

      expect(verifyToken).toHaveBeenCalledWith("valid-token");
    });
  });
});
