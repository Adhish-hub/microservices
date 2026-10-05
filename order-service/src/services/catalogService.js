const axios = require("axios");

const CATALOG_URL = process.env.CATALOG_SERVICE_URL;

// The order's name and price come from catalog-service — NEVER from the
// client. If the request body supplied the price, anyone could order a
// product for 1 rupee by editing the request.
async function getProductById(productId) {
  try {
    const response = await axios.get(
      `${CATALOG_URL}/api/products/${encodeURIComponent(productId)}`,
      { timeout: 3000 },
    );
    return response.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return null; // product genuinely doesn't exist
    }

    // A malformed id makes catalog respond 400 (CastError). To the caller
    // that is also "no such product".
    if (err.response && err.response.status === 400) {
      return null;
    }

    // Catalog is unreachable, timed out, or errored — different from
    // "not found", and the caller must be able to tell them apart.
    const serviceError = new Error("Catalog service unavailable");
    serviceError.status = 503;
    throw serviceError;
  }
}

module.exports = { getProductById };
