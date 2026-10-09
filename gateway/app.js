require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const authMiddleware = require("./middlewares/authMiddleware");
const authorizeRoles = require("./middlewares/roleMiddleware");
const { apiRateLimiter } = require("./middlewares/rateLimitMiddleware");

const identityMiddleware = require("./middlewares/identityMiddleware");

const { requireParamOwnership } = require("./middlewares/ownershipMiddleware");

const { createResilientProxy } = require("./middlewares/resilientProxy");

const errorMiddleware = require("./middlewares/errorMiddleware");

const app = express();

/*
|--------------------------------------------------------------------------
| Security
|--------------------------------------------------------------------------
*/

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  }),
);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);

/*
 * IMPORTANT:
 *
 * Do NOT use express.json() here.
 *
 * http-proxy-middleware needs access to the original request body.
 */

app.use(apiRateLimiter);

/*
|--------------------------------------------------------------------------
| Public Authentication
|--------------------------------------------------------------------------
*/

const [authCircuit, authProxy] = createResilientProxy({
  target: "http://auth-service:4001",
  timeout: 5000,
  failureThreshold: 5,
  resetTimeout: 15000,
  pathRewrite: {
    "^/": "/api/auth/",
  },
});

app.use("/api/auth", authCircuit, authProxy);

/*
|--------------------------------------------------------------------------
| Public Catalog
|--------------------------------------------------------------------------
*/

const [catalogPublicCircuit, catalogPublicProxy] = createResilientProxy({
  target: "http://catalog-service:4002",
  timeout: 5000,
  failureThreshold: 5,
  resetTimeout: 15000,
});

app.get("/api/products", catalogPublicCircuit, catalogPublicProxy);

app.get("/api/products/:id", catalogPublicCircuit, catalogPublicProxy);

/*
|--------------------------------------------------------------------------
| Protected Catalog Operations
|--------------------------------------------------------------------------
*/

const [catalogProtectedCircuit, catalogProtectedProxy] = createResilientProxy({
  target: "http://catalog-service:4002",
  timeout: 5000,
  failureThreshold: 5,
  resetTimeout: 15000,
  pathRewrite: {
    "^/": "/api/products/",
  },
});

app.post(
  "/api/products",
  authMiddleware,
  authorizeRoles("seller", "admin"),
  catalogProtectedCircuit,
  catalogProtectedProxy,
);

app.put(
  "/api/products/:id",
  authMiddleware,
  authorizeRoles("seller", "admin"),
  catalogProtectedCircuit,
  catalogProtectedProxy,
);

app.delete(
  "/api/products/:id",
  authMiddleware,
  authorizeRoles("admin"),
  catalogProtectedCircuit,
  catalogProtectedProxy,
);

/*
|--------------------------------------------------------------------------
| Cart
|--------------------------------------------------------------------------
*/

const [cartCircuit, cartProxy] = createResilientProxy({
  target: "http://cart-service:4003",
  timeout: 5000,
  failureThreshold: 5,
  resetTimeout: 15000,
  pathRewrite: {
    "^/": "/api/cart/",
  },
});

app.use(
  "/api/cart/:userId",
  authMiddleware,
  identityMiddleware,
  requireParamOwnership("userId"),
  cartCircuit,
  cartProxy,
);

/*
|--------------------------------------------------------------------------
| Orders
|--------------------------------------------------------------------------
*/

const [orderCircuit, orderProxy] = createResilientProxy({
  target: "http://order-service:4005",
  timeout: 10000,
  failureThreshold: 5,
  resetTimeout: 15000,
  pathRewrite: {
    "^/": "/api/orders/",
  },
});

app.use(
  "/api/orders",
  authMiddleware,
  identityMiddleware,
  orderCircuit,
  orderProxy,
);

/*
|--------------------------------------------------------------------------
| Notifications
|--------------------------------------------------------------------------
*/

const [notificationCircuit, notificationProxy] = createResilientProxy({
  target: "http://notification-service:4007",
  timeout: 5000,
  failureThreshold: 5,
  resetTimeout: 15000,
  pathRewrite: {
    "^/": "/api/notifications/",
  },
});

app.use(
  "/api/notifications",
  authMiddleware,
  identityMiddleware,
  notificationCircuit,
  notificationProxy,
);

/*
|--------------------------------------------------------------------------
| Payments
|--------------------------------------------------------------------------
*/

const [paymentCircuit, paymentProxy] = createResilientProxy({
  target: "http://payment-service:4006",
  timeout: 10000,
  failureThreshold: 5,
  resetTimeout: 15000,
  pathRewrite: {
    "^/": "/api/payments/",
  },
});

app.use(
  "/api/payments",
  authMiddleware,
  identityMiddleware,
  paymentCircuit,
  paymentProxy,
);

/*
|--------------------------------------------------------------------------
| Gateway Health
|--------------------------------------------------------------------------
*/

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "gateway",
  });
});

/*
|--------------------------------------------------------------------------
| Error Handler
|--------------------------------------------------------------------------
*/

app.use(errorMiddleware);

module.exports = app;
