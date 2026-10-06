const crypto = require("crypto");

function verifyPaymentSignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(razorpaySignature);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function verifyWebhookSignature(rawBody, signature) {
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

module.exports = {
  verifyPaymentSignature,
  verifyWebhookSignature,
};


