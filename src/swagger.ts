/**
 * Swagger/OpenAPI Configuration for Moodring API
 * 
 * This file exports the OpenAPI specification for the Moodring prediction market API.
 * Use with swagger-ui-express or similar to serve documentation.
 */

export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Moodring API",
    version: "1.0.0",
    description: "Solana-based prediction market platform API",
    contact: {
      name: "Moodring Support",
      url: "https://moodring.app",
    },
  },
  servers: [
    {
      url: "http://localhost:5001",
      description: "Development server",
    },
    {
      url: "https://api.moodring.app",
      description: "Production server",
    },
  ],
  tags: [
    { name: "Auth", description: "Authentication endpoints" },
    { name: "User", description: "User management and portfolio" },
    { name: "Market", description: "Prediction market operations" },
    { name: "Trade", description: "Trading operations" },
    { name: "Liquidity", description: "Liquidity provision" },
    { name: "Withdrawal", description: "Withdrawal management" },
    { name: "Activity", description: "Activity feed" },
    { name: "Notifications", description: "User notifications" },
    { name: "Comments", description: "Market comments" },
    { name: "Referral", description: "Referral system" },
    { name: "Analytics", description: "Platform analytics" },
    { name: "Admin", description: "Admin operations" },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        description: "Check API health status",
        responses: {
          "200": {
            description: "API is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    timestamp: { type: "string", format: "date-time" },
                    uptime: { type: "number" },
                    version: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/magic-link/request": {
      post: {
        tags: ["Auth"],
        summary: "Request magic link OTP",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "OTP sent successfully" },
          "400": { description: "Invalid email" },
        },
      },
    },
    "/api/auth/magic-link/verify": {
      post: {
        tags: ["Auth"],
        summary: "Verify magic link OTP",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "otp"],
                properties: {
                  email: { type: "string", format: "email" },
                  otp: { type: "string", minLength: 6, maxLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Login successful" },
          "401": { description: "Invalid or expired OTP" },
        },
      },
    },
    "/api/auth/wallet/authenticate": {
      post: {
        tags: ["Auth"],
        summary: "Authenticate with Solana wallet",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["wallet_address", "signature", "message"],
                properties: {
                  wallet_address: { type: "string" },
                  signature: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Login successful" },
          "201": { description: "Account created successfully" },
          "401": { description: "Invalid signature" },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Current user details" },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/market": {
      get: {
        tags: ["Market"],
        summary: "Get markets with filtering",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, max: 100 } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["active", "resolved", "expired", "all"] } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["volume", "created", "expiration", "trending"] } },
          { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "featured", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          "200": { description: "List of markets with pagination" },
        },
      },
    },
    "/api/market/featured": {
      get: {
        tags: ["Market"],
        summary: "Get featured markets",
        responses: {
          "200": { description: "List of featured markets" },
        },
      },
    },
    "/api/market/trending": {
      get: {
        tags: ["Market"],
        summary: "Get trending markets",
        responses: {
          "200": { description: "List of trending markets" },
        },
      },
    },
    "/api/market/{id}": {
      get: {
        tags: ["Market"],
        summary: "Get market details",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": { description: "Market details with options" },
          "404": { description: "Market not found" },
        },
      },
    },
    "/api/trade/buy": {
      post: {
        tags: ["Trade"],
        summary: "Buy shares",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["market", "option", "buyYes", "buyNo", "usdcMint"],
                properties: {
                  market: { type: "string" },
                  option: { type: "string" },
                  buyYes: { type: "integer" },
                  buyNo: { type: "integer" },
                  maxCost: { type: "integer" },
                  usdcMint: { type: "string" },
                  slippageBps: { type: "integer", max: 10000 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Trade executed successfully" },
          "404": { description: "Wallet not found" },
        },
      },
    },
    "/api/trade/sell": {
      post: {
        tags: ["Trade"],
        summary: "Sell shares",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["market", "option", "sellYes", "sellNo", "usdcMint"],
                properties: {
                  market: { type: "string" },
                  option: { type: "string" },
                  sellYes: { type: "integer" },
                  sellNo: { type: "integer" },
                  minPayout: { type: "integer" },
                  usdcMint: { type: "string" },
                  slippageBps: { type: "integer", max: 10000 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Trade executed successfully" },
        },
      },
    },
    "/api/trade/history": {
      get: {
        tags: ["Trade"],
        summary: "Get trade history",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "Trade history with pagination" },
        },
      },
    },
    "/api/user/portfolio": {
      get: {
        tags: ["User"],
        summary: "Get user portfolio",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "User portfolio overview" },
        },
      },
    },
    "/api/withdrawal/request": {
      post: {
        tags: ["Withdrawal"],
        summary: "Request withdrawal",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["destination_address", "amount", "token_symbol"],
                properties: {
                  destination_address: { type: "string" },
                  amount: { type: "integer" },
                  token_symbol: { type: "string", enum: ["SOL", "USDC"] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Withdrawal completed" },
          "400": { description: "Insufficient balance or pending withdrawal" },
        },
      },
    },
    "/api/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "Get notifications",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "unread", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          "200": { description: "Notifications with unread count" },
        },
      },
    },
    "/api/comments": {
      post: {
        tags: ["Comments"],
        summary: "Create comment",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["market_id", "content"],
                properties: {
                  market_id: { type: "string", format: "uuid" },
                  content: { type: "string", maxLength: 2000 },
                  parent_id: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Comment created" },
        },
      },
    },
    "/api/comments/market/{id}": {
      get: {
        tags: ["Comments"],
        summary: "Get market comments",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "page", in: "query", schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "Comments with pagination" },
        },
      },
    },
    "/api/referral/code": {
      get: {
        tags: ["Referral"],
        summary: "Get or create referral code",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Referral code and stats" },
        },
      },
    },
    "/api/analytics/platform": {
      get: {
        tags: ["Analytics"],
        summary: "Get platform statistics",
        responses: {
          "200": { description: "Platform-wide statistics" },
        },
      },
    },
    "/api/analytics/leaderboard/volume": {
      get: {
        tags: ["Analytics"],
        summary: "Get volume leaderboard",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", max: 100 } },
        ],
        responses: {
          "200": { description: "Leaderboard by trading volume" },
        },
      },
    },
    "/api/activity/feed": {
      get: {
        tags: ["Activity"],
        summary: "Get activity feed",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "Public activity feed" },
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
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "accessToken",
      },
    },
    schemas: {
      Market: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          creator_id: { type: "string", format: "uuid" },
          question: { type: "string" },
          market_description: { type: "string" },
          image_url: { type: "string" },
          expiration_timestamp: { type: "integer" },
          total_volume: { type: "integer" },
          is_resolved: { type: "boolean" },
          is_featured: { type: "boolean" },
          categories: {
            type: "array",
            items: { $ref: "#/components/schemas/Category" },
          },
          options: {
            type: "array",
            items: { $ref: "#/components/schemas/Option" },
          },
        },
      },
      Option: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          option_label: { type: "string" },
          yes_quantity: { type: "integer" },
          no_quantity: { type: "integer" },
          is_resolved: { type: "boolean" },
          winning_side: { type: "integer", nullable: true },
        },
      },
      Category: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
        },
      },
      Trade: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          trade_type: { type: "string", enum: ["buy", "sell"] },
          side: { type: "string", enum: ["yes", "no"] },
          quantity: { type: "integer" },
          total_cost: { type: "integer" },
          transaction_signature: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", nullable: true },
          username: { type: "string" },
          display_name: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Pagination: {
        type: "object",
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
          hasMore: { type: "boolean" },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
};

export default swaggerDocument;

