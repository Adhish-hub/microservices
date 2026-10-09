const openApiSpec = {
  openapi: "3.0.3",

  info: {
    title: "Microservices Ecommerce API",
    version: "1.0.0",
    description:
      "API documentation for the Microservices Ecommerce application. " +
      "Requests are handled through the API Gateway.",
  },

  servers: [
    {
      url: "http://localhost:8080",
      description: "Local API Gateway",
    },
  ],

  tags: [
    { name: "Health", description: "Gateway health checks" },
    {
      name: "Authentication",
      description: "User registration and authentication",
    },
    { name: "Products", description: "Product catalog operations" },
    { name: "Cart", description: "Shopping cart operations" },
    { name: "Orders", description: "Order management" },
    { name: "Payments", description: "Payment creation and verification" },
    { name: "Notifications", description: "User notification management" },
  ],

  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Check API Gateway health",
        responses: {
          200: {
            description: "Gateway is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    service: { type: "string", example: "gateway" },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/api/auth/register": {
      post: {
        tags: ["Authentication"],
        summary: "Register a user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    example: "alex@example.com",
                  },
                  password: {
                    type: "string",
                    format: "password",
                    example: "StrongPassword123!",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "User registered successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          409: {
            description: "Email is already registered",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },

    "/api/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Log in a user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    example: "alex@example.com",
                  },
                  password: {
                    type: "string",
                    format: "password",
                    example: "StrongPassword123!",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Login successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/auth/verify": {
      get: {
        tags: ["Authentication"],
        summary: "Verify the current access token",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Token is valid",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    valid: { type: "boolean", example: true },
                    user: { type: "object", additionalProperties: true },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/products": {
      get: {
        tags: ["Products"],
        summary: "Get products",
        description:
          "Returns a paginated list of products with optional filters.",
        parameters: [
          {
            name: "page",
            in: "query",
            description: "Page number",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "limit",
            in: "query",
            description: "Number of products per page; maximum 100",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },
          {
            name: "category",
            in: "query",
            description: "Filter by category",
            schema: { type: "string" },
          },
          {
            name: "minPrice",
            in: "query",
            description: "Minimum product price",
            schema: { type: "number", minimum: 0 },
          },
          {
            name: "maxPrice",
            in: "query",
            description: "Maximum product price",
            schema: { type: "number", minimum: 0 },
          },
        ],
        responses: {
          200: {
            description: "Products retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    products: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Product" },
                    },
                    pagination: {
                      type: "object",
                      properties: {
                        page: { type: "integer", example: 1 },
                        limit: { type: "integer", example: 20 },
                        total: { type: "integer", example: 45 },
                        totalPages: { type: "integer", example: 3 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      post: {
        tags: ["Products"],
        summary: "Create a product",
        description: "Requires the seller or admin role.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProductInput" },
            },
          },
        },
        responses: {
          201: {
            description: "Product created successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Product" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },

    "/api/products/{id}": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Product ID",
        },
      ],

      get: {
        tags: ["Products"],
        summary: "Get a product by ID",
        responses: {
          200: {
            description: "Product retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Product" },
              },
            },
          },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },

      put: {
        tags: ["Products"],
        summary: "Update a product",
        description: "Requires the seller or admin role.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProductInput" },
            },
          },
        },
        responses: {
          200: {
            description: "Product updated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Product" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },

      delete: {
        tags: ["Products"],
        summary: "Delete a product",
        description: "Requires the admin role.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Product deleted successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Message" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/api/cart/{userId}": {
      parameters: [
        {
          name: "userId",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID of the authenticated user",
        },
      ],

      get: {
        tags: ["Cart"],
        summary: "Get a user's cart",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Cart retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Cart" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },

      delete: {
        tags: ["Cart"],
        summary: "Clear a user's cart",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Cart cleared successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Message" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },

    "/api/cart/{userId}/items": {
      parameters: [
        {
          name: "userId",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID of the authenticated user",
        },
      ],

      post: {
        tags: ["Cart"],
        summary: "Add an item to the cart",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["productId", "quantity"],
                properties: {
                  productId: {
                    type: "string",
                    example: "product-123",
                  },
                  quantity: {
                    type: "integer",
                    minimum: 1,
                    example: 2,
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Item added successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Cart" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/api/cart/{userId}/items/{productId}": {
      parameters: [
        {
          name: "userId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
        {
          name: "productId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],

      delete: {
        tags: ["Cart"],
        summary: "Remove an item from the cart",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Cart updated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Cart" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },

    "/api/orders": {
      post: {
        tags: ["Orders"],
        summary: "Create an order",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["items"],
                properties: {
                  items: {
                    type: "array",
                    minItems: 1,
                    items: {
                      type: "object",
                      required: ["productId", "quantity"],
                      properties: {
                        productId: {
                          type: "string",
                          example: "product-123",
                        },
                        quantity: {
                          type: "integer",
                          minimum: 1,
                          example: 2,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Order created successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Order" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
          409: {
            description: "Insufficient stock or conflicting reservation",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },

    "/api/orders/{id}": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Order ID",
        },
      ],

      get: {
        tags: ["Orders"],
        summary: "Get an order by ID",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Order retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Order" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/api/payments": {
      post: {
        tags: ["Payments"],
        summary: "Create a payment",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: true,
            description:
              "Unique key used to prevent duplicate payment creation",
            schema: {
              type: "string",
              maxLength: 100,
              example: "payment-request-unique-001",
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["orderId"],
                properties: {
                  orderId: {
                    type: "string",
                    example: "order-123",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Payment created successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Payment" },
              },
            },
          },
          200: {
            description: "Existing payment returned for the idempotency key",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Payment" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/api/payments/verify": {
      post: {
        tags: ["Payments"],
        summary: "Verify a payment",
        description:
          "Verifies the payment signature using the payment provider's credentials.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "razorpayOrderId",
                  "razorpayPaymentId",
                  "razorpaySignature",
                ],
                properties: {
                  razorpayOrderId: {
                    type: "string",
                    example: "order_example123",
                  },
                  razorpayPaymentId: {
                    type: "string",
                    example: "pay_example123",
                  },
                  razorpaySignature: {
                    type: "string",
                    example: "example_signature",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Payment verified or already verified",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      example: "Payment verified successfully.",
                    },
                    payment: { $ref: "#/components/schemas/Payment" },
                  },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/api/payments/{id}": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Payment ID",
        },
      ],

      get: {
        tags: ["Payments"],
        summary: "Get a payment by ID",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Payment retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Payment" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/api/notifications/user/{userId}": {
      parameters: [
        {
          name: "userId",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID of the authenticated user",
        },
      ],

      get: {
        tags: ["Notifications"],
        summary: "Get a user's notifications",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Notifications retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    notifications: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: true,
                      },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/notifications/{id}/read": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Notification ID",
        },
      ],

      patch: {
        tags: ["Notifications"],
        summary: "Mark a notification as read",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Notification marked as read",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    notification: {
                      type: "object",
                      additionalProperties: true,
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/api/notifications/user/{userId}/read-all": {
      parameters: [
        {
          name: "userId",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID of the authenticated user",
        },
      ],

      patch: {
        tags: ["Notifications"],
        summary: "Mark all of a user's notifications as read",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Notifications marked as read",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      example: "All notifications mark as read.",
                    },
                    count: {
                      type: "integer",
                      example: 5,
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
  },

  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter your access token without the Bearer prefix.",
      },
    },

    schemas: {
      Error: {
        type: "object",
        properties: {
          message: {
            type: "string",
            example: "An error occurred.",
          },
        },
      },

      Message: {
        type: "object",
        properties: {
          message: {
            type: "string",
            example: "Operation completed successfully.",
          },
        },
      },

      AuthResponse: {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              id: { type: "string", example: "user-123" },
              email: {
                type: "string",
                format: "email",
                example: "alex@example.com",
              },
              role: {
                type: "string",
                enum: ["customer", "seller", "admin"],
                example: "customer",
              },
            },
          },
          token: {
            type: "string",
            description: "Access token",
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          },
        },
      },

      ProductInput: {
        type: "object",
        required: ["name", "price", "category"],
        properties: {
          name: {
            type: "string",
            example: "Wireless Headphones",
          },
          description: {
            type: "string",
            example: "Wireless headphones with noise cancellation",
          },
          price: {
            type: "number",
            minimum: 0,
            example: 2999,
          },
          category: {
            type: "string",
            example: "Electronics",
          },
          stock: {
            type: "integer",
            minimum: 0,
            example: 50,
          },
          images: {
            type: "array",
            items: { type: "string" },
            example: ["https://example.com/headphones.jpg"],
          },
        },
      },

      Product: {
        allOf: [
          { $ref: "#/components/schemas/ProductInput" },
          {
            type: "object",
            properties: {
              _id: { type: "string", example: "product-123" },
              id: { type: "string", example: "product-123" },
              createdAt: {
                type: "string",
                format: "date-time",
              },
              updatedAt: {
                type: "string",
                format: "date-time",
              },
            },
          },
        ],
      },

      Cart: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                productId: {
                  type: "string",
                  example: "product-123",
                },
                quantity: {
                  type: "integer",
                  minimum: 1,
                  example: 2,
                },
              },
              additionalProperties: true,
            },
          },
        },
        additionalProperties: true,
      },

      Order: {
        type: "object",
        properties: {
          _id: { type: "string", example: "order-123" },
          userId: { type: "string", example: "user-123" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                productId: { type: "string", example: "product-123" },
                quantity: { type: "integer", example: 2 },
              },
              additionalProperties: true,
            },
          },
          status: {
            type: "string",
            example: "pending",
          },
          totalAmount: {
            type: "number",
            example: 5998,
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
        },
        additionalProperties: true,
      },

      Payment: {
        type: "object",
        properties: {
          id: { type: "string", example: "payment-123" },
          orderId: { type: "string", example: "order-123" },
          amount: { type: "number", example: 5998 },
          currency: { type: "string", example: "INR" },
          status: {
            type: "string",
            example: "created",
          },
          idempotencyKey: {
            type: "string",
            example: "payment-request-unique-001",
          },
          razorpayOrderId: {
            type: "string",
            example: "order_example123",
          },
          razorpayKeyId: {
            type: "string",
            example: "rzp_test_example",
          },
        },
        additionalProperties: true,
      },
    },

    responses: {
      BadRequest: {
        description: "The request is invalid",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },

      Unauthorized: {
        description: "Authentication is required or the token is invalid",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },

      Forbidden: {
        description: "You do not have permission to perform this operation",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },

      NotFound: {
        description: "The requested resource was not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
  },
};

module.exports = openApiSpec;
