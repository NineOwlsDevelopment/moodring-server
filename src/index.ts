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

// Trust proxy for accurate IP detection (important for rate limiting and IP filtering)
// Set to 1 to trust first proxy, or use specific number for multiple proxies
// app.set("trust proxy", process.env.TRUST_PROXY === "false" ? false : 1);

// ============================================================================
// Configuration
// ============================================================================
const cors_options = {
  credentials: true,
  exposedHeaders: ["Set-Cookie"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Set-Cookie",
    "Access-Control-Allow-Origin",
  ],
  origin: [
    process.env.CLIENT_URL || "http://localhost:5173",
    "https://moodring.io",
    "http://moodring.io",
    "wss://moodring.io",
    "ws://moodring.io",
    "https://172.105.155.223",
    "http://172.105.155.223",
    "wss://172.105.155.223",
    "ws://172.105.155.223",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
};

const PORT = process.env.PORT || 5001;

// ============================================================================
// Security Middleware
// ============================================================================
// Initialize secrets manager
// CRITICAL: In production, this must be blocking to ensure secrets are loaded
if (process.env.NODE_ENV === "production") {
  (async () => {
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
      console.error(
        "❌ CRITICAL: Secrets manager initialization failed. Exiting."
      );
      process.exit(1);
    }
  })();
} else {
  // Development: non-blocking with warning
  (async () => {
    try {
      await initializeSecrets();
      await initializePool();
      console.log("✅ Secrets manager and database pool initialized");
      // Initialize Redis revocation cache (optional, graceful fallback)
      const { initializeRevocationCache } = await import("./utils/revocation");
      await initializeRevocationCache();
    } catch (error) {
      console.warn("⚠️  Secrets manager not available, using env vars:", error);
    }
  })();
}

// // Helmet.js - Security headers
// app.use(
//   helmet({
//     contentSecurityPolicy: {
//       directives: {
//         defaultSrc: ["'self'"],
//         styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React
//         scriptSrc: ["'self'"],
//         imgSrc: ["'self'", "data:", "https:"], // Allow images from any HTTPS source
//         connectSrc: [
//           "'self'",
//           process.env.CLIENT_URL || "http://localhost:3000",
//           "http://moodring.io",
//           "https://moodring.io",
//           "wss://moodring.io",
//           "ws://moodring.io",
//           "http://172.105.155.223",
//           "https://172.105.155.223",
//           "wss://172.105.155.223",
//           "ws://172.105.155.223",
//         ],
//         fontSrc: ["'self'", "data:"],
//         objectSrc: ["'none'"],
//         upgradeInsecureRequests:
//           process.env.NODE_ENV === "production" ? [] : null,
//       },
//     },
//     crossOriginEmbedderPolicy: false, // Disable for compatibility
//     hsts: {
//       maxAge: 31536000, // 1 year
//       includeSubDomains: true,
//       preload: true,
//     },
//   })
// );

// Global IP blacklist (applied to all routes)
app.use(globalIPBlacklist);

// CORS configuration
app.use(cors(cors_options));

// Cookie parser
app.use(cookieParser());

// Request size limits to prevent DoS attacks
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging middleware - Logs the request method and path in the console
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ============================================================================
// Routes
// ============================================================================
// Health check endpoint (no rate limiting)
app.get("/health", healthCheck);

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
app.use("/api/admin", adminIPWhitelist, route_admin);

// ============================================================================
// Service Initialization
// ============================================================================
// Initialize Circle wallet service for user wallets
(async () => {
  const circleWalletInitialized = await initializeCircleWallet();
  if (circleWalletInitialized) {
    console.log(`✅ Circle wallet service initialized`);
  } else {
    console.warn(
      "⚠️  Circle wallet service not configured. Set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET in .env for user wallet creation."
    );
  }
})();

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

// ============================================================================
// Production-Specific Middleware
// ============================================================================
if (process.env.NODE_ENV === "production") {
  // // Redirect http to https and remove www from URL
  // app.use((req, res, next) => {
  //   // Redirect http to https
  //   if (req.header("x-forwarded-proto") !== "https") {
  //     return res.redirect(`https://${req.header("host")}${req.url}`);
  //   }
  //   // Replace www with non-www
  //   if (req.header("host")?.startsWith("www.")) {
  //     return res.redirect(
  //       301,
  //       `https://${req.header("host")?.replace("www.", "")}${req.url}`
  //     );
  //   }
  //   next();
  // });
  // // Serve static files from client build folder
  // console.log("Production environment");
  // app.use(express.static(path.join(__dirname, "../client/dist")));
  // app.get("*", (_, res) => {
  //   res.sendFile(path.resolve(__dirname, "../client/dist", "index.html"));
  // });
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
