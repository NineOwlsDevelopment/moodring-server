// ============================================================================
// Environment Configuration
// ============================================================================
// Set timezone to New York (must be before any date operations)
process.env.TZ = "America/New_York";

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({
  path: path.join(__dirname, ".env"),
});

// ============================================================================
// External Dependencies
// ============================================================================
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { createServer } from "http";

// ============================================================================
// Internal Routes
// ============================================================================
import route_auth from "./routes/route_auth";
import route_user from "./routes/route_user";
import route_admin from "./routes/route_admin";
import route_market from "./routes/route_market";
import route_trade from "./routes/route_trade";
import route_liquidity from "./routes/route_liquidity";
import route_withdrawal from "./routes/route_withdrawal";
import route_activity from "./routes/route_activity";
import route_notification from "./routes/route_notification";
import route_comment from "./routes/route_comment";
import route_analytics from "./routes/route_analytics";
import route_resolution from "./routes/route_resolution";
import route_post from "./routes/route_post";
import route_key from "./routes/route_key";
import { getMarketMeta } from "./controllers/controller_market";
import { GetMarketRequest } from "./types/requests";

// ============================================================================
// Internal Services & Middleware
// ============================================================================
import { initializeWebSocket } from "./services/websocket";
import { startDepositListener } from "./services/depositListener";
import { startResolutionProcessor } from "./services/resolutionProcessor";
import { initializeCircleWallet } from "./services/circleWallet";
import { initializeWithdrawalQueue } from "./services/withdrawalQueue";
import { generalLimiter } from "./middleware/rateLimit";
import { healthCheck } from "./controllers/controller_analytics";
import { globalIPBlacklist, adminIPWhitelist } from "./middleware/ipFilter";
import { initializeSecrets } from "./utils/secrets";
import { initializePool } from "./db";

// ============================================================================
// Express App Initialization
// ============================================================================
const app = express();

// SECURITY FIX: Set trust proxy to 1 (number of proxies) instead of true
// This prevents IP spoofing attacks while still allowing Cloudflare to work
// Setting to 1 means we trust only the first proxy (Cloudflare)
app.set("trust proxy", 1);

// ============================================================================
// Configuration
// ============================================================================
// Allowed origins for CORS - includes environment variable and common domains
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:5173",
  "http://10.0.0.35:5173",
  "https://10.0.0.35:5173",
  "https://moodring.io",
  "http://moodring.io",
  "https://www.moodring.io",
  "http://www.moodring.io",
];

// Dynamic origin function for CORS - more flexible than static array
const corsOrigin = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
  // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
  if (!origin) {
    return callback(null, true);
  }

  // Check if origin is in allowed list
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  // In development, be more permissive
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[CORS] Allowing origin in development: ${origin}`);
    return callback(null, true);
  }

  // In production, log blocked origins for debugging
  console.warn(`[CORS] Blocked origin: ${origin}`);
  callback(new Error("Not allowed by CORS"));
};

const cors_options = {
  credentials: true,
  exposedHeaders: ["Set-Cookie"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Set-Cookie",
    "Access-Control-Allow-Origin",
    "X-Forwarded-For",
    "X-Real-IP",
    "CF-Connecting-IP", // Cloudflare's real client IP header
    "CF-Ray", // Cloudflare request ID
    "CF-Visitor", // Cloudflare visitor info (scheme)
    "Origin", // Allow Origin header
    "Referer", // Allow Referer header
  ],
  origin: corsOrigin, // Use dynamic function instead of static array
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  preflightContinue: false,
  optionsSuccessStatus: 204, // Some legacy browsers choke on 204
};

const PORT = process.env.PORT || 5001;

// ============================================================================
// Security Middleware
// ============================================================================
// Initialize secrets manager and database pool
// CRITICAL: In production, this must be blocking to ensure secrets are loaded
const initPromise = (async () => {
  try {
    await initializeSecrets();
    console.log("✅ Secrets manager initialized successfully");
    // Initialize database pool after secrets are loaded
    await initializePool();
    console.log("✅ Database pool initialized successfully");
    // Initialize Redis revocation cache (optional, graceful fallback)
    const { initializeRevocationCache } = await import("./utils/revocation");
    await initializeRevocationCache();
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "❌ CRITICAL: Secrets manager initialization failed. Exiting."
      );
      process.exit(1);
    } else {
      console.warn("⚠️  Secrets manager not available, using env vars:", error);
    }
  }
})();

// Helmet.js - Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"], // Allow images from any HTTPS source
        connectSrc: [
          "'self'",
          "http://10.0.0.35:5173",
          "https://10.0.0.35:5173",
          "ws://localhost:*",
          "wss://localhost:*",
          "https://moodring.io",
          "wss://moodring.io",
          "https://www.moodring.io",
          "wss://www.moodring.io",
          "https://dev.moodring.io",
          "wss://dev.moodring.io",
        ],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for compatibility
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  })
);

// CORS configuration - MUST be before IP blacklist to allow preflight OPTIONS requests
app.use(cors(cors_options));

// Global IP blacklist (applied to all routes)
// Note: Health check is excluded in the IP filter middleware
app.use(globalIPBlacklist);

// Cookie parser
app.use(cookieParser());

// Request size limits to prevent DoS attacks
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging middleware - Logs the request method and path in the console
// Also logs Cloudflare headers in production for debugging
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    const cfIP = req.headers["cf-connecting-ip"] as string | undefined;
    const cfRay = req.headers["cf-ray"] as string | undefined;
    console.log(
      `${req.method} ${req.path}${cfIP ? ` [CF-IP: ${cfIP}]` : ""}${
        cfRay ? ` [CF-Ray: ${cfRay}]` : ""
      }`
    );
  } else {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// ============================================================================
// Routes
// ============================================================================
// Health check endpoint (no rate limiting, no IP filtering, accessible to Cloudflare)
// This endpoint is excluded from IP blacklist in the middleware
app.get("/health", healthCheck);
app.options("/health", (req, res) => {
  // Explicitly handle OPTIONS for health check
  res.status(204).end();
});

// API Versioning - All routes under /api/v1/
const API_VERSION = "/api/v1";

// Apply general rate limiting to all API routes
app.use(API_VERSION, generalLimiter);

// Public routes (no IP restrictions)
app.use(`${API_VERSION}/auth`, route_auth);
app.use(`${API_VERSION}/user`, route_user);
app.use(`${API_VERSION}/market`, route_market);
app.use(`${API_VERSION}/trade`, route_trade);
app.use(`${API_VERSION}/liquidity`, route_liquidity);
app.use(`${API_VERSION}/withdrawal`, route_withdrawal);
app.use(`${API_VERSION}/activity`, route_activity);
app.use(`${API_VERSION}/notifications`, route_notification);
app.use(`${API_VERSION}/comments`, route_comment);
app.use(`${API_VERSION}/analytics`, route_analytics);
app.use(`${API_VERSION}/resolution`, route_resolution);
app.use(`${API_VERSION}/posts`, route_post);
app.use(`${API_VERSION}/key`, route_key);

// Admin routes with IP whitelist
app.use(`${API_VERSION}/admin`, adminIPWhitelist, route_admin);

// Legacy API routes (backward compatibility - deprecated)
// These routes will be removed in a future version
// Apply rate limiting to legacy routes too
app.use("/api", generalLimiter);

app.use("/api/auth", route_auth);
app.use("/api/user", route_user);
app.use("/api/market", route_market);
app.use("/api/trade", route_trade);
app.use("/api/liquidity", route_liquidity);
app.use("/api/withdrawal", route_withdrawal);
app.use("/api/activity", route_activity);
app.use("/api/notifications", route_notification);
app.use("/api/comments", route_comment);
app.use("/api/analytics", route_analytics);
app.use("/api/resolution", route_resolution);
app.use("/api/posts", route_post);
app.use("/api/key", route_key);
app.use("/api/admin", adminIPWhitelist, route_admin);

// ============================================================================
// Service Initialization
// ============================================================================
// Initialize services after database pool is ready
(async () => {
  // Wait for secrets and database pool to be initialized
  await initPromise;

  // Initialize Circle wallet service for user wallets
  const circleWalletInitialized = await initializeCircleWallet();
  if (circleWalletInitialized) {
    console.log(`✅ Circle wallet service initialized`);
  } else {
    console.warn(
      "⚠️  Circle wallet service not configured. Set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET in .env for user wallet creation."
    );
  }

  // Start deposit listener to detect and sweep user deposits
  if (process.env.RPC_URL) {
    startDepositListener();
    console.log("✅ Deposit listener started");
  } else {
    console.warn("⚠️  RPC_URL not set. Deposit listener disabled.");
  }

  // Start resolution processor to handle automatic payouts and market resolution
  startResolutionProcessor();
  console.log("✅ Resolution processor started");

  // Initialize withdrawal job queue (SECURITY FIX: CVE-004)
  initializeWithdrawalQueue();
  console.log("✅ Withdrawal queue initialized");
})();

// ============================================================================
// Production-Specific Middleware
// ============================================================================
if (process.env.NODE_ENV === "production") {
  // Serve static files from client build folder
  // This MUST be before the catch-all route to ensure JS/CSS files are served with correct MIME types
  // Note: __dirname will be src/dist when compiled, so we need to go up two levels to reach client/dist
  console.log("Production environment - serving static files from client/dist");
  app.use(
    express.static(path.join(__dirname, "../../client/dist"), {
      // Ensure proper MIME types for JavaScript modules
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".js")) {
          res.setHeader(
            "Content-Type",
            "application/javascript; charset=utf-8"
          );
        }
      },
    })
  );

  // Catch-all handler: send back React's index.html file for SPA routing
  // This must be LAST, after all API routes and static file serving
  app.get("*", async (req, res, next) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith("/api")) {
      return next();
    }

    // Check if this is a market route and if the user agent is a social media crawler
    const marketRouteMatch = req.path.match(/^\/market\/([a-f0-9-]{36})$/i);
    if (marketRouteMatch) {
      const userAgent = req.get("user-agent") || "";
      // List of social media crawler user agents
      const socialCrawlers = [
        "facebookexternalhit",
        "Facebot",
        "Twitterbot",
        "LinkedInBot",
        "WhatsApp",
        "Discordbot",
        "TelegramBot",
        "Slackbot",
        "Applebot",
        "Googlebot",
        "bingbot",
        "Slurp",
        "DuckDuckBot",
        "Baiduspider",
        "YandexBot",
        "Sogou",
        "Exabot",
        "ia_archiver",
      ];

      const isSocialCrawler = socialCrawlers.some((crawler) =>
        userAgent.toLowerCase().includes(crawler.toLowerCase())
      );

      if (isSocialCrawler) {
        // Extract market ID and serve meta HTML
        const marketId = marketRouteMatch[1];
        // Create a mock request object for getMarketMeta
        const mockReq = {
          params: { id: marketId },
        } as GetMarketRequest;
        try {
          await getMarketMeta(mockReq, res);
          return; // getMarketMeta handles the response
        } catch (error) {
          console.error("Error serving market meta:", error);
          // Fall through to serve regular index.html on error
        }
      }
    }

    // Default: serve React app
    res.sendFile(path.resolve(__dirname, "../../client/dist", "index.html"));
  });
}

// ============================================================================
// Server Setup
// ============================================================================
// Create HTTP server
const server = createServer(app);

// Initialize WebSocket if enabled
const enableWebSocket = process.env.ENABLE_WEBSOCKET !== "false";
if (enableWebSocket) {
  initializeWebSocket(server);
  console.log("[WebSocket] Enabled");
} else {
  console.log("[WebSocket] Disabled via ENABLE_WEBSOCKET flag");
}

// Start server
server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Server running on port: ${PORT}`);
  console.log(
    `✅ Server timezone: ${process.env.TZ} (${new Date().toLocaleString(
      "en-US",
      {
        timeZoneName: "short",
      }
    )})`
  );
});

// ============================================================================
// Error Handling
// ============================================================================
// Prevent the server from crashing on unhandled promise rejections
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});
