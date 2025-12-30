"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ============================================================================
// Environment Configuration
// ============================================================================
// Set timezone to New York (must be before any date operations)
process.env.TZ = "America/New_York";
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv.config({
    path: path_1.default.join(__dirname, ".env"),
});
// ============================================================================
// External Dependencies
// ============================================================================
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const http_1 = require("http");
// ============================================================================
// Internal Routes
// ============================================================================
const route_auth_1 = __importDefault(require("./routes/route_auth"));
const route_user_1 = __importDefault(require("./routes/route_user"));
const route_admin_1 = __importDefault(require("./routes/route_admin"));
const route_market_1 = __importDefault(require("./routes/route_market"));
const route_trade_1 = __importDefault(require("./routes/route_trade"));
const route_liquidity_1 = __importDefault(require("./routes/route_liquidity"));
const route_withdrawal_1 = __importDefault(require("./routes/route_withdrawal"));
const route_activity_1 = __importDefault(require("./routes/route_activity"));
const route_notification_1 = __importDefault(require("./routes/route_notification"));
const route_comment_1 = __importDefault(require("./routes/route_comment"));
const route_analytics_1 = __importDefault(require("./routes/route_analytics"));
const route_resolution_1 = __importDefault(require("./routes/route_resolution"));
const route_post_1 = __importDefault(require("./routes/route_post"));
const route_key_1 = __importDefault(require("./routes/route_key"));
const controller_market_1 = require("./controllers/controller_market");
// ============================================================================
// Internal Services & Middleware
// ============================================================================
const websocket_1 = require("./services/websocket");
const depositListener_1 = require("./services/depositListener");
const resolutionProcessor_1 = require("./services/resolutionProcessor");
const circleWallet_1 = require("./services/circleWallet");
const withdrawalQueue_1 = require("./services/withdrawalQueue");
const rateLimit_1 = require("./middleware/rateLimit");
const controller_analytics_1 = require("./controllers/controller_analytics");
const ipFilter_1 = require("./middleware/ipFilter");
const secrets_1 = require("./utils/secrets");
const db_1 = require("./db");
// ============================================================================
// Express App Initialization
// ============================================================================
const app = (0, express_1.default)();
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
const corsOrigin = (origin, callback) => {
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
        await (0, secrets_1.initializeSecrets)();
        console.log("✅ Secrets manager initialized successfully");
        // Initialize database pool after secrets are loaded
        await (0, db_1.initializePool)();
        console.log("✅ Database pool initialized successfully");
        // Initialize Redis revocation cache (optional, graceful fallback)
        const { initializeRevocationCache } = await Promise.resolve().then(() => __importStar(require("./utils/revocation")));
        await initializeRevocationCache();
    }
    catch (error) {
        if (process.env.NODE_ENV === "production") {
            console.error("❌ CRITICAL: Secrets manager initialization failed. Exiting.");
            process.exit(1);
        }
        else {
            console.warn("⚠️  Secrets manager not available, using env vars:", error);
        }
    }
})();
// Helmet.js - Security headers
app.use((0, helmet_1.default)({
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
            upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
        },
    },
    crossOriginEmbedderPolicy: false, // Disable for compatibility
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
    },
}));
// CORS configuration - MUST be before IP blacklist to allow preflight OPTIONS requests
app.use((0, cors_1.default)(cors_options));
// Global IP blacklist (applied to all routes)
// Note: Health check is excluded in the IP filter middleware
app.use(ipFilter_1.globalIPBlacklist);
// Cookie parser
app.use((0, cookie_parser_1.default)());
// Request size limits to prevent DoS attacks
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
// Request logging middleware - Logs the request method and path in the console
// Also logs Cloudflare headers in production for debugging
app.use((req, res, next) => {
    if (process.env.NODE_ENV === "production") {
        const cfIP = req.headers["cf-connecting-ip"];
        const cfRay = req.headers["cf-ray"];
        console.log(`${req.method} ${req.path}${cfIP ? ` [CF-IP: ${cfIP}]` : ""}${cfRay ? ` [CF-Ray: ${cfRay}]` : ""}`);
    }
    else {
        console.log(`${req.method} ${req.path}`);
    }
    next();
});
// ============================================================================
// Routes
// ============================================================================
// Health check endpoint (no rate limiting, no IP filtering, accessible to Cloudflare)
// This endpoint is excluded from IP blacklist in the middleware
app.get("/health", controller_analytics_1.healthCheck);
app.options("/health", (req, res) => {
    // Explicitly handle OPTIONS for health check
    res.status(204).end();
});
// API Versioning - All routes under /api/v1/
const API_VERSION = "/api/v1";
// Apply general rate limiting to all API routes
app.use(API_VERSION, rateLimit_1.generalLimiter);
// Public routes (no IP restrictions)
app.use(`${API_VERSION}/auth`, route_auth_1.default);
app.use(`${API_VERSION}/user`, route_user_1.default);
app.use(`${API_VERSION}/market`, route_market_1.default);
app.use(`${API_VERSION}/trade`, route_trade_1.default);
app.use(`${API_VERSION}/liquidity`, route_liquidity_1.default);
app.use(`${API_VERSION}/withdrawal`, route_withdrawal_1.default);
app.use(`${API_VERSION}/activity`, route_activity_1.default);
app.use(`${API_VERSION}/notifications`, route_notification_1.default);
app.use(`${API_VERSION}/comments`, route_comment_1.default);
app.use(`${API_VERSION}/analytics`, route_analytics_1.default);
app.use(`${API_VERSION}/resolution`, route_resolution_1.default);
app.use(`${API_VERSION}/posts`, route_post_1.default);
app.use(`${API_VERSION}/key`, route_key_1.default);
// Admin routes with IP whitelist
app.use(`${API_VERSION}/admin`, ipFilter_1.adminIPWhitelist, route_admin_1.default);
// Legacy API routes (backward compatibility - deprecated)
// These routes will be removed in a future version
// Apply rate limiting to legacy routes too
app.use("/api", rateLimit_1.generalLimiter);
app.use("/api/auth", route_auth_1.default);
app.use("/api/user", route_user_1.default);
app.use("/api/market", route_market_1.default);
app.use("/api/trade", route_trade_1.default);
app.use("/api/liquidity", route_liquidity_1.default);
app.use("/api/withdrawal", route_withdrawal_1.default);
app.use("/api/activity", route_activity_1.default);
app.use("/api/notifications", route_notification_1.default);
app.use("/api/comments", route_comment_1.default);
app.use("/api/analytics", route_analytics_1.default);
app.use("/api/resolution", route_resolution_1.default);
app.use("/api/posts", route_post_1.default);
app.use("/api/key", route_key_1.default);
app.use("/api/admin", ipFilter_1.adminIPWhitelist, route_admin_1.default);
// ============================================================================
// Service Initialization
// ============================================================================
// Initialize services after database pool is ready
(async () => {
    // Wait for secrets and database pool to be initialized
    await initPromise;
    // Initialize Circle wallet service for user wallets
    const circleWalletInitialized = await (0, circleWallet_1.initializeCircleWallet)();
    if (circleWalletInitialized) {
        console.log(`✅ Circle wallet service initialized`);
    }
    else {
        console.warn("⚠️  Circle wallet service not configured. Set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET in .env for user wallet creation.");
    }
    // Start deposit listener to detect and sweep user deposits
    if (process.env.RPC_URL) {
        (0, depositListener_1.startDepositListener)();
        console.log("✅ Deposit listener started");
    }
    else {
        console.warn("⚠️  RPC_URL not set. Deposit listener disabled.");
    }
    // Start resolution processor to handle automatic payouts and market resolution
    (0, resolutionProcessor_1.startResolutionProcessor)();
    console.log("✅ Resolution processor started");
    // Initialize withdrawal job queue (SECURITY FIX: CVE-004)
    (0, withdrawalQueue_1.initializeWithdrawalQueue)();
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
    app.use(express_1.default.static(path_1.default.join(__dirname, "../../client/dist"), {
        // Ensure proper MIME types for JavaScript modules
        setHeaders: (res, filePath) => {
            if (filePath.endsWith(".js")) {
                res.setHeader("Content-Type", "application/javascript; charset=utf-8");
            }
        },
    }));
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
            const isSocialCrawler = socialCrawlers.some((crawler) => userAgent.toLowerCase().includes(crawler.toLowerCase()));
            if (isSocialCrawler) {
                // Extract market ID and serve meta HTML
                const marketId = marketRouteMatch[1];
                // Create a mock request object for getMarketMeta
                const mockReq = {
                    params: { id: marketId },
                };
                try {
                    await (0, controller_market_1.getMarketMeta)(mockReq, res);
                    return; // getMarketMeta handles the response
                }
                catch (error) {
                    console.error("Error serving market meta:", error);
                    // Fall through to serve regular index.html on error
                }
            }
        }
        // Default: serve React app
        res.sendFile(path_1.default.resolve(__dirname, "../../client/dist", "index.html"));
    });
}
// ============================================================================
// Server Setup
// ============================================================================
// Create HTTP server
const server = (0, http_1.createServer)(app);
// Initialize WebSocket if enabled
const enableWebSocket = process.env.ENABLE_WEBSOCKET !== "false";
if (enableWebSocket) {
    (0, websocket_1.initializeWebSocket)(server);
    console.log("[WebSocket] Enabled");
}
else {
    console.log("[WebSocket] Disabled via ENABLE_WEBSOCKET flag");
}
// Start server
server.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on port: ${PORT}`);
    console.log(`✅ Server timezone: ${process.env.TZ} (${new Date().toLocaleString("en-US", {
        timeZoneName: "short",
    })})`);
});
// ============================================================================
// Error Handling
// ============================================================================
// Prevent the server from crashing on unhandled promise rejections
process.on("unhandledRejection", (error) => {
    console.error("Unhandled promise rejection:", error);
});
//# sourceMappingURL=index.js.map