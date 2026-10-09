jest.mock("../src/config/redis", () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock("../src/services/catalogService", () => ({
  getProductById: jest.fn(),
}));

const { redisClient } = require("../src/config/redis");
const catalogService = require("../src/services/catalogService");
const {
  getCart,
  addItem,
  removeItem,
  clearCart,
} = require("../src/controllers/cartController");

function makeResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("Cart controller", () => {
  beforeEach(() => jest.clearAllMocks());

  test("rejects a request without an authenticated user ID", async () => {
    const res = makeResponse();
    const next = jest.fn();

    await getCart({ headers: {}, params: {} }, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: "Authenticated user ID is missing.",
      }),
    );
  });

  test("returns an empty cart when Redis has no cart", async () => {
    redisClient.get.mockResolvedValue(null);

    const req = {
      headers: { "x-user-id": "user-1" },
    };
    const res = makeResponse();

    await getCart(req, res, jest.fn());

    expect(redisClient.get).toHaveBeenCalledWith("cart:user-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ items: [] });
  });

  test("adds a catalog product to the cart", async () => {
    redisClient.get.mockResolvedValue(null);
    catalogService.getProductById.mockResolvedValue({
      _id: "product-1",
      name: "Keyboard",
      price: 1200,
    });

    const req = {
      headers: { "x-user-id": "user-1" },
      body: { productId: "product-1", quantity: 2 },
    };
    const res = makeResponse();

    await addItem(req, res, jest.fn());

    expect(redisClient.set).toHaveBeenCalledWith(
      "cart:user-1",
      JSON.stringify({
        items: [
          {
            productId: "product-1",
            name: "Keyboard",
            price: 1200,
            quantity: 2,
          },
        ],
      }),
      { EX: 604800 },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("rejects an invalid quantity", async () => {
    const req = {
      headers: { "x-user-id": "user-1" },
      body: { productId: "product-1", quantity: 0 },
    };
    const res = makeResponse();

    await addItem(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(catalogService.getProductById).not.toHaveBeenCalled();
  });

  test("removes an item from the cart", async () => {
    redisClient.get.mockResolvedValue(
      JSON.stringify({
        items: [
          { productId: "product-1", quantity: 1 },
          { productId: "product-2", quantity: 3 },
        ],
      }),
    );

    const req = {
      headers: { "x-user-id": "user-1" },
      params: { productId: "product-1" },
    };
    const res = makeResponse();

    await removeItem(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({
      items: [{ productId: "product-2", quantity: 3 }],
    });
  });

  test("clears a user's cart", async () => {
    redisClient.del.mockResolvedValue(1);

    const req = { headers: { "x-user-id": "user-1" } };
    const res = makeResponse();

    await clearCart(req, res, jest.fn());

    expect(redisClient.del).toHaveBeenCalledWith("cart:user-1");
    expect(res.json).toHaveBeenCalledWith({
      message: "Cart cleared.",
    });
  });
});
