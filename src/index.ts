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
import { generalLimiter } from "./middleware/rateLimit";
import { healthCheck } from "./controllers/controller_analytics";

// ============================================================================
// Express App Initialization
// ============================================================================
const app = express();

// ============================================================================
// Configuration
// ============================================================================
const cors_options = {
  credentials: true,
  exposedHeaders: ["Set-Cookie"],
  allowedHeaders: ["Content-Type", "Authorization", "Set-Cookie"],
  origin: [
    process.env.CLIENT_URL || "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "https://moodring.io",
    "https://dev.moodring.io",
    "http://localhost:5173",
    "http://localhost:3000",
    "wss://dev.moodring.io",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
};

const PORT = process.env.PORT || 5001;

// ============================================================================
// Middleware
// ============================================================================
app.use(cors(cors_options));
app.use(cookieParser());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ============================================================================
// Routes
// ============================================================================
// Health check endpoint (no rate limiting)
app.get("/health", healthCheck);

// Apply general rate limiting to all API routes
app.use("/api", generalLimiter);
app.use("/api/auth", route_auth);
app.use("/api/user", route_user);
app.use("/api/admin", route_admin);
app.use("/api/market", route_market);
app.use("/api/trade", route_trade);
app.use("/api/liquidity", route_liquidity);
app.use("/api/withdrawal", route_withdrawal);
app.use("/api/activity", route_activity);
app.use("/api/notifications", route_notification);
app.use("/api/comments", route_comment);
app.use("/api/analytics", route_analytics);
app.use("/api/resolution", route_resolution);

// ============================================================================
// Service Initialization
// ============================================================================
// Initialize Circle wallet service for user wallets
const circleWalletInitialized = initializeCircleWallet();
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

// ============================================================================
// Production-Specific Middleware
// ============================================================================
if (process.env.NODE_ENV === "production") {
  // Redirect http to https and remove www from URL
  app.use((req, res, next) => {
    // Redirect http to https
    if (req.header("x-forwarded-proto") !== "https") {
      return res.redirect(`https://${req.header("host")}${req.url}`);
    }

    // Replace www with non-www
    if (req.header("host")?.startsWith("www.")) {
      return res.redirect(
        301,
        `https://${req.header("host")?.replace("www.", "")}${req.url}`
      );
    }

    next();
  });

  // Serve static files from client build folder
  console.log("Production environment");
  app.use(express.static(path.join(__dirname, "../client/dist")));

  app.get("*", (_, res) => {
    res.sendFile(path.resolve(__dirname, "../client/dist", "index.html"));
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
