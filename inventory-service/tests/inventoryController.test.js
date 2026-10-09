jest.mock("../src/config/prisma", () => ({
  stock: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
  reservation: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
}));

const prisma = require("../src/config/prisma");
const {
  upperStock,
  getStock,
  getReservation,
  reserveStock,
  confirmReservation,
  releaseReservation,
} = require("../src/controllers/inventoryController");

function makeResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("Inventory controller", () => {
  beforeEach(() => jest.clearAllMocks());

  test("rejects negative stock", async () => {
    const req = {
      body: { productId: "product-1", available: -1 },
    };
    const res = makeResponse();

    await upperStock(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.stock.upsert).not.toHaveBeenCalled();
  });

  test("creates or updates stock", async () => {
    const stock = { productId: "product-1", available: 10 };
    prisma.stock.upsert.mockResolvedValue(stock);

    const req = {
      body: { productId: "product-1", available: 10 },
    };
    const res = makeResponse();

    await upperStock(req, res, jest.fn());

    expect(prisma.stock.upsert).toHaveBeenCalledWith({
      where: { productId: "product-1" },
      update: { available: 10 },
      create: { productId: "product-1", available: 10 },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(stock);
  });

  test("returns 404 when stock does not exist", async () => {
    prisma.stock.findUnique.mockResolvedValue(null);

    const req = { params: { productId: "missing-product" } };
    const res = makeResponse();

    await getStock(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("rejects a reservation without items", async () => {
    const req = {
      body: { orderId: "order-1", items: [] },
    };
    const res = makeResponse();
    const next = jest.fn();

    await reserveStock(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        message: "Items must be a non empty array.",
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });


test("returns existing reservations for a repeated order", async () => {
  const reservations = [
    {
      orderId: "order-1",
      productId: "product-1",
      quantity: 2,
      status: "pending",
    },
  ];

  const findMany = jest.fn().mockResolvedValue(reservations);
  const updateMany = jest.fn();

  prisma.$transaction.mockImplementation(async (callback) => {
    return callback({
      reservation: {
        findMany,
      },
      stock: {
        updateMany,
      },
    });
  });

  const req = {
    body: {
      orderId: "order-1",
      items: [{ productId: "product-1", quantity: 2 }],
    },
  };

  const res = makeResponse();
  const next = jest.fn();

  await reserveStock(req, res, next);

  expect(next).not.toHaveBeenCalled();
  expect(findMany).toHaveBeenCalledTimes(1);
  expect(updateMany).not.toHaveBeenCalled();

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({
    orderId: "order-1",
    reservations,
  });
});


  test("returns 404 when a reservation cannot be found for confirmation", async () => {
    prisma.$transaction.mockImplementation(async (callback) => {
      return callback({
        reservation: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      });
    });

    const req = { params: { orderId: "missing-order" } };
    const next = jest.fn();

    await confirmReservation(req, makeResponse(), next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 404,
        message: "Reservation not found.",
      }),
    );
  });

  test("returns 404 when a reservation cannot be found for release", async () => {
    prisma.$transaction.mockImplementation(async (callback) => {
      return callback({
        reservation: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      });
    });

    const req = { params: { orderId: "missing-order" } };
    const next = jest.fn();

    await releaseReservation(req, makeResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
  });

  test("returns 404 when no reservation exists for an order", async () => {
    prisma.reservation.findMany.mockResolvedValue([]);

    const req = { params: { orderId: "missing-order" } };
    const res = makeResponse();

    await getReservation(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
