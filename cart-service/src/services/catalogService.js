const axios = require("axios");

const CATALOG_URL = process.env.CATALOG_SERVICE_URL;

async function getProductById(productId){
    try{
        const response = await axios.get(`${CATALOG_URL}/api/products/${productId}`, {
            timeout: 3000
        });
        return response.data;
    }catch(err){
      if (err.response && err.response.status === 404) {
        return null;
      }
      // Catalog is unreachable, timed out, or errored — this IS an error,
      // distinct from "product not found". The caller needs to tell these apart.
      const serviceError = new Error("Catalog service unavailable");
      serviceError.status = 503;
      throw serviceError;
    }
}

module.exports = { getProductById };