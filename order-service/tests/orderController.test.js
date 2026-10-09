jest.mock("../src/config/prisma", () => ({
  order: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
}));

jest.mock("../src/services/catalogService", () => ({
  getProductById: jest.fn(),
}));

jest.mock("../src/services/inventoryService", () => ({
  reserveStock: jest.fn(),
}));

jest.mock("../src/services/outboxService", () => ({
  createOutboxEvent: jest.fn(),
}));

jest.mock("../src/services/paymentOrderService", () => ({
  handlePaymentFailure: jest.fn(),
  handlePaymentSuccess: jest.fn(),
}));

const prisma = require("../src/config/prisma");
const catalogService = require("../src/services/catalogService");
const {
  createOrder,
  getOrder,
  paymentFailure,
  paymentSuccess,
} = require("../src/controllers/orderController");

const inventoryService = require("../src/services/inventoryService");
const {
  handlePaymentFailure,
  handlePaymentSuccess,
} = require("../src/services/paymentOrderService");

function makeResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("Order controller", () => {
  beforeEach(() => jest.clearAllMocks());

  test("rejects order creation without an authenticated user", async () => {
    const req = {
      headers: {},
      body: { items: [{ productId: "product-1", quantity: 1 }] },
    };
    const res = makeResponse();

    await createOrder(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("rejects an order with no items", async () => {
    const req = {
      headers: { "x-user-id": "user-1" },
      body: { items: [] },
    };
    const res = makeResponse();

    await createOrder(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("returns 404 when an order is not owned by the user", async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    const req = {
      headers: { "x-user-id": "user-1" },
      params: { id: "order-1" },
    };
    const res = makeResponse();

    await getOrder(req, res, jest.fn());

    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: { id: "order-1", userId: "user-1" },
      include: { items: true },
    });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("returns an order belonging to the authenticated user", async () => {
    const order = {
      id: "order-1",
      userId: "user-1",
      totalPrice: 1200,
      items: [],
    };
    prisma.order.findFirst.mockResolvedValue(order);

    const req = {
      headers: { "x-user-id": "user-1" },
      params: { id: "order-1" },
    };
    const res = makeResponse();

    await getOrder(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(order);
  });

  test("delegates successful payment handling", async () => {
    const order = { id: "order-1", status: "confirmed" };
    handlePaymentSuccess.mockResolvedValue(order);

    const req = { params: { id: "order-1" } };
    const res = makeResponse();

    await paymentSuccess(req, res, jest.fn());

    expect(handlePaymentSuccess).toHaveBeenCalledWith("order-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("delegates failed payment handling", async () => {
    const order = { id: "order-1", status: "failed" };
    handlePaymentFailure.mockResolvedValue(order);

    const req = { params: { id: "order-1" } };
    const res = makeResponse();

    await paymentFailure(req, res, jest.fn());

    expect(handlePaymentFailure).toHaveBeenCalledWith("order-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
