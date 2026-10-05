const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = process.env.PORT || 8080;

// The frontend will only ever talk to the gateway (localhost:8080).
// The gateway forwards matching requests to whichever service owns them.
// As we build more services, we add one more proxy rule per service —
// the frontend's URL never has to change.
app.use(
  "/api/auth",
  createProxyMiddleware({
    target: "http://auth-service:4001", // auth-service
    changeOrigin: true,
    pathRewrite: { "^/": "/api/auth/" }, // Express strips the mount
    // path before we get here —
    // this adds it back so
    // auth-service sees the
    // full original path.
  }),
);

app.use(
  "/api/products",
  createProxyMiddleware({
    target: "http://catalog-service:4002", // catalog-service
    changeOrigin: true,
    pathRewrite: { "^/": "/api/products/" },
  }),
);

app.use(
  "/api/cart",
  createProxyMiddleware({
    target: "http://cart-service:4003", // catalog-service
    changeOrigin: true,
    pathRewrite: { "^/": "/api/cart/" },
  }),
);

app.use(
  "/api/inventory",
  createProxyMiddleware({
    target: "http://inventory-service:4004",
    changeOrigin: true,
    pathRewrite: { "^/": "/api/inventory/" },
  }),
);

app.use(
  "/api/orders",
  createProxyMiddleware({
    target: "http://order-service:4005",
    changeOrigin: true,
    pathRewrite: { "^/": "/api/orders/" },
  }),
);

app.get("/health", (req, res) =>
  res.json({ status: "ok", service: "gateway" }),
);

app.listen(PORT, () => {
  console.log(`gateway listening on port ${PORT}`);
});
