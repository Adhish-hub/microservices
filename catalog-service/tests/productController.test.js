jest.mock("../src/models/Product", () => ({
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

const Product = require("../src/models/Product");
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} = require("../src/controllers/productController");

function makeResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("Catalog product controller", () => {
  beforeEach(() => jest.clearAllMocks());

  test("rejects a product missing required fields", async () => {
    const req = { body: { name: "Keyboard" } };
    const res = makeResponse();
    const next = jest.fn();

    await createProduct(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Product.create).not.toHaveBeenCalled();
  });

  test("creates a product", async () => {
    const product = {
      _id: "product-1",
      name: "Keyboard",
      price: 1200,
      category: "electronics",
    };

    Product.create.mockResolvedValue(product);

    const req = {
      body: {
        name: "Keyboard",
        price: 1200,
        category: "electronics",
      },
    };
    const res = makeResponse();

    await createProduct(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(product);
  });

  test("returns paginated products", async () => {
    const products = [{ _id: "product-1", name: "Keyboard" }];
    const sort = jest.fn().mockResolvedValue(products);
    const limit = jest.fn().mockReturnValue({ sort });
    const skip = jest.fn().mockReturnValue({ limit });

    Product.find.mockReturnValue({ skip });
    Product.countDocuments.mockResolvedValue(21);

    const req = { query: { page: "2", limit: "10" } };
    const res = makeResponse();

    await getProducts(req, res, jest.fn());

    expect(Product.find).toHaveBeenCalledWith({});
    expect(skip).toHaveBeenCalledWith(10);
    expect(limit).toHaveBeenCalledWith(10);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      products,
      pagination: {
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
      },
    });
  });

  test("returns 404 when a product does not exist", async () => {
    Product.findById.mockResolvedValue(null);

    const req = { params: { id: "missing-product" } };
    const res = makeResponse();

    await getProductById(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Product not found.",
    });
  });

  test("updates an existing product", async () => {
    const product = { _id: "product-1", name: "Updated Keyboard" };
    Product.findByIdAndUpdate.mockResolvedValue(product);

    const req = {
      params: { id: "product-1" },
      body: { name: "Updated Keyboard" },
    };
    const res = makeResponse();

    await updateProduct(req, res, jest.fn());

    expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(
      "product-1",
      { name: "Updated Keyboard" },
      { new: true, runValidators: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(product);
  });

  test("deletes an existing product", async () => {
    Product.findByIdAndDelete.mockResolvedValue({ _id: "product-1" });

    const req = { params: { id: "product-1" } };
    const res = makeResponse();

    await deleteProduct(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Product deleted successfully.",
    });
  });
});
