jest.mock("../src/config/prisma", () => ({
  payment: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("../src/config/razorpay", () => ({
  orders: {
    create: jest.fn(),
  },
}));

jest.mock("../src/services/orderService", () => ({
  getOrderById: jest.fn(),
  notifyPaymentSuccess: jest.fn(),
  notifyPaymentFailure: jest.fn(),
}));

jest.mock("../src/services/paymentVerificationService", () => ({
  verifyPaymentSignature: jest.fn(),
}));

const prisma = require("../src/config/prisma");
const {
  createPayment,
  getPayment,
  verifyPayment,
} = require("../src/controllers/paymentController");

const razorpay = require("../src/config/razorpay");
const { getOrderById } = require("../src/services/orderService");
const {
  verifyPaymentSignature,
} = require("../src/services/paymentVerificationService");

function makeResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("Payment controller", () => {
  beforeEach(() => jest.clearAllMocks());

  test("requires an idempotency key", async () => {
    const req = {
      get: jest.fn().mockReturnValue(undefined),
      body: { orderId: "order-1" },
    };
    const res = makeResponse();

    await createPayment(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });

  test("rejects payment creation without an order ID", async () => {
    const req = {
      get: jest.fn().mockReturnValue("key-1"),
      body: {},
    };
    const res = makeResponse();

    await createPayment(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "orderId is required.",
    });
  });

  test("returns an existing payment for a repeated idempotency key", async () => {
    const payment = {
      id: "payment-1",
      orderId: "order-1",
      status: "created",
      idempotencyKey: "key-1",
    };
    prisma.payment.findUnique.mockResolvedValue(payment);

    const req = {
      get: jest.fn().mockReturnValue("key-1"),
      body: { orderId: "order-1" },
    };
    const res = makeResponse();

    await createPayment(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(payment);
    expect(getOrderById).not.toHaveBeenCalled();
  });

  test("returns 404 when the payment does not exist", async () => {
    prisma.payment.findUnique.mockResolvedValue(null);

    const req = { params: { id: "payment-missing" } };
    const res = makeResponse();

    await getPayment(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("rejects verification when required fields are missing", async () => {
    const req = { body: { razorpayOrderId: "razorpay-order-1" } };
    const res = makeResponse();

    await verifyPayment(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(verifyPaymentSignature).not.toHaveBeenCalled();
  });

  test("returns 404 when the payment order ID is unknown", async () => {
    prisma.payment.findUnique.mockResolvedValue(null);

    const req = {
      body: {
        razorpayOrderId: "unknown",
        razorpayPaymentId: "payment-1",
        razorpaySignature: "signature",
      },
    };
    const res = makeResponse();

    await verifyPayment(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("returns success when a payment is already paid", async () => {
    const payment = {
      id: "payment-1",
      orderId: "order-1",
      status: "paid",
    };
    prisma.payment.findUnique.mockResolvedValue(payment);

    const req = {
      body: {
        razorpayOrderId: "razorpay-order-1",
        razorpayPaymentId: "razorpay-payment-1",
        razorpaySignature: "signature",
      },
    };
    const res = makeResponse();

    await verifyPayment(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Payment already verified.",
      payment,
    });
    expect(verifyPaymentSignature).not.toHaveBeenCalled();
  });
});
