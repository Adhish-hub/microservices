function errorMiddleware(err, req, res, next) {
  console.log(err);

  // Unique-constraint violation. With the (orderId, productId) unique key
  // this only fires when two identical reserve requests race each other.
  if (err.code === "P2002") {
    return res.status(409).json({
      message: "A reservation for this order already exists.",
    });
  }

  const body = { message: err.message || "Internal server error" };

  // Let the caller know WHICH product caused an insufficient-stock error.
  if (err.productId) body.productId = err.productId;

  res.status(err.status || 500).json(body);
}

module.exports = errorMiddleware;
