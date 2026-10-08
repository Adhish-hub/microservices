require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { createProxyMiddleware } = require("http-proxy-middleware");

const authMiddleware = require("./middlewares/authMiddleware");
const authorizeRoles = require("./middlewares/roleMiddleware");
const { apiRateLimiter } = require("./middlewares/rateLimitMiddleware");
const errorMiddleware = require("./middlewares/errorMiddleware");

const identityMiddleware = require("./middlewares/identityMiddleware");

const { requireParamOwnership } = require("./middlewares/ownershipMiddleware");

const app = express();

const PORT = process.env.PORT || 8080;

app.disable("x-powered-by");

/*
|--------------------------------------------------------------------------
| Security Middleware
|--------------------------------------------------------------------------
*/

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

// app.use(express.json());

app.use(apiRateLimiter);

/*
|--------------------------------------------------------------------------
| Public Authentication Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/auth",
  createProxyMiddleware({
    target: "http://auth-service:4001",
    changeOrigin: true,
    pathRewrite: {
      "^/": "/api/auth/",
    },
  }),
);

/*
|--------------------------------------------------------------------------
| Public Catalog Routes
|--------------------------------------------------------------------------
|
| GET /api/products
| GET /api/products/:id
|
| Product creation/modification is protected below.
|--------------------------------------------------------------------------
*/

app.get(
  "/api/products",
  createProxyMiddleware({
    target: "http://catalog-service:4002",
    changeOrigin: true,
  }),
);

app.get(
  "/api/products/:id",
  createProxyMiddleware({
    target: "http://catalog-service:4002",
    changeOrigin: true,
  }),
);

/*
|--------------------------------------------------------------------------
| Seller/Admin Catalog Operations
|--------------------------------------------------------------------------
*/

app.post(
  "/api/products",
  authMiddleware,
  authorizeRoles("seller", "admin"),
  createProxyMiddleware({
    target: "http://catalog-service:4002",
    changeOrigin: true,
    pathRewrite: {
      "^/": "/api/products/",
    },
  }),
);

app.put(
  "/api/products/:id",
  authMiddleware,
  authorizeRoles("seller", "admin"),
  createProxyMiddleware({
    target: "http://catalog-service:4002",
    changeOrigin: true,
    pathRewrite: {
      "^/": "/api/products/",
    },
  }),
);

app.delete(
  "/api/products/:id",
  authMiddleware,
  authorizeRoles("admin"),
  createProxyMiddleware({
    target: "http://catalog-service:4002",
    changeOrigin: true,
    pathRewrite: {
      "^/": "/api/products/",
    },
  }),
);

/*
|--------------------------------------------------------------------------
| Cart
|--------------------------------------------------------------------------
*/

app.use(
  "/api/cart/:userId",
  authMiddleware,
  identityMiddleware,
  requireParamOwnership("userId"),
  createProxyMiddleware({
    target: "http://cart-service:4003",
    changeOrigin: true,
    pathRewrite: {
      "^/": "/api/cart/",
    },
  }),
);

/*
|--------------------------------------------------------------------------
| Orders
|--------------------------------------------------------------------------
*/

app.use(
  "/api/orders",
  authMiddleware,
  identityMiddleware,
  createProxyMiddleware({
    target: "http://order-service:4005",
    changeOrigin: true,
    pathRewrite: {
      "^/": "/api/orders/",
    },
  }),
);

/*
|--------------------------------------------------------------------------
| Notifications
|--------------------------------------------------------------------------
*/

app.use(
  "/api/notifications",
  authMiddleware,
  identityMiddleware,
  createProxyMiddleware({
    target: "http://notification-service:4007",
    changeOrigin: true,
    pathRewrite: {
      "^/": "/api/notifications/",
    },
  }),
);


app.use(
  "/api/payments",
  authMiddleware,
  identityMiddleware,
  createProxyMiddleware({
    target: "http://payment-service:4006",
    changeOrigin: true,
    pathRewrite: {
      "^/": "/api/payments/",
    },
  }),
);



/*
|--------------------------------------------------------------------------
| Health
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

app.listen(PORT, () => {
  console.log(`Gateway listening on port ${PORT}`);
});



//Email: paymenttest@example.com
//Password: Password@123