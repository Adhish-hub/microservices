const axios = require("axios");

const INVENTORY_URL = process.env.INVENTORY_SERVICE_URL;

async function reserveStock(orderId, productId, quantity){
    const response = await axios.post(
      `${INVENTORY_URL}/api/inventory/reserve`,
      { orderId, productId, quantity },
      { timeout: 5000 },
    );
    return response.data;
}

async function confirmReservation(orderId){
    const response = await axios.post(
      `${INVENTORY_URL}/api/inventory/confirm/${orderId}`,
      {},
      { timeout: 5000 },
    );
    return response.data
}

async function releaseReservation(orderId){
    const response = await axios.post(
      `${INVENTORY_URL}/api/inventory/release/${orderId}`,
      {},
      { timeout: 5000 },
    );  
    return response.data; 
}

module.exports = {reserveStock, confirmReservation, releaseReservation};