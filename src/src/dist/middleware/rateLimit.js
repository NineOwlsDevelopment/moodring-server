"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminLimiter = exports.voteLimiter = exports.marketCreationLimiter = exports.withdrawalLimiter = exports.claimLimiter = exports.commentLimiter = exports.tradeLimiter = exports.strictLimiter = exports.authLimiter = exports.generalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rate_limit_redis_1 = require("rate-limit-redis");
const redis_1 = require("redis");
/**
 * Rate Limiting Middleware using express-rate-limit
 * Industry standard with optional Redis support for distributed systems
 */
// Initialize Redis client if configured
let redisClient = null;
let redisStore = null;
if (process.env.REDIS_URL || process.env.REDIS_HOST) {
    try {
        redisClient = (0, redis_1.createClient)({
            url: process.env.REDIS_URL,
            socket: process.env.REDIS_HOST
                ? {
                    host: process.env.REDIS_HOST,
                    port: parseInt(process.env.REDIS_PORT || "6379"),
                }
                : undefined,
            // Enable cluster mode if using ElastiCache cluster configuration endpoint
            // The client will automatically detect cluster mode from the endpoint
        });
        redisClient.on("error", (err) => {
            console.error("[Rate Limit] Redis error:", err);
        });
        redisClient
            .connect()
            .then(() => {
            console.log("✅ Redis connected for rate limiting");
            redisStore = new rate_limit_redis_1.RedisStore({
                sendCommand: async (...args) => {
                    return redisClient.sendCommand(args);
                },
            });
        })
            .catch((err) => {
            console.warn("⚠️  Failed to connect to Redis. Using in-memory rate limiting:", err);
        });
    }
    catch (error) {
        console.warn("⚠️  Redis not available. Using in-memory rate limiting:", error);
    }
}
/**
 * Get the real client IP address
 * Prioritizes Cloudflare's CF-Connecting-IP header (most reliable)
 * Falls back to req.ip (which uses X-Forwarded-For when trust proxy is set)
 * Finally falls back to connection IP
 */
const getClientIP = (req) => {
    // Cloudflare's CF-Connecting-IP is the most reliable source
    // It cannot be spoofed by clients
    const cfIP = req.headers["cf-connecting-ip"];
    if (cfIP) {
        return cfIP;
    }
    // Fall back to req.ip (uses X-Forwarded-For when trust proxy is configured)
    // With trust proxy set to 1, this is safe from spoofing
    if (req.ip) {
        return req.ip;
    }
    // Last resort: use connection IP
    return req.socket.remoteAddress || "unknown";
};
/**
 * Create a rate limiter with standard configuration
 */
const createLimiter = (windowMs, max, message, skip) => {
    return (0, express_rate_limit_1.default)({
        windowMs,
        max,
        message: {
            error: "Too Many Requests",
            message,
        },
        standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
        legacyHeaders: false, // Disable `X-RateLimit-*` headers
        store: redisStore || undefined, // Use Redis if available, otherwise in-memory
        skip: skip || (() => false),
        // SECURITY FIX: Use custom keyGenerator to prioritize CF-Connecting-IP
        // This prevents IP spoofing attacks while maintaining compatibility
        keyGenerator: (req) => getClientIP(req),
        handler: (req, res) => {
            const clientIP = getClientIP(req);
            console.warn(`[Rate Limit] ${message} from IP: ${clientIP}`);
            res.status(429).json({
                error: "Too Many Requests",
                message,
            });
        },
    });
};
/**
 * General rate limiter - applied to all API routes
 */
exports.generalLimiter = createLimiter(1 * 60 * 1000, // 1 minute
120, // 120 requests per minute (fixed typo from 12000)
"Too many requests from this IP, please try again after 1 minute");
/**
 * Authentication rate limiter
 * Stricter limits for login/registration endpoints
 */
exports.authLimiter = createLimiter(60 * 60 * 1000, // 1 hour
10, // 10 login attempts per hour (fixed typo from 100000)
"Too many authentication attempts, please try again after an hour");
/**
 * Strict rate limiter
 * Very restrictive for sensitive operations
 */
exports.strictLimiter = createLimiter(60 * 1000, // 1 minute
10, // 10 requests per minute
"Rate limit exceeded, please slow down");
/**
 * Trading rate limiter
 * SECURITY FIX (CVE-009): Reduced from 20 to 5 trades per minute to prevent rapid exploitation
 */
exports.tradeLimiter = createLimiter(60 * 1000, // 1 minute
5, // 5 trades per minute (reduced from 20)
"Trading rate limit exceeded, please wait before making more trades");
/**
 * Comment rate limiter
 * Prevents comment spam
 */
exports.commentLimiter = createLimiter(60 * 1000, // 1 minute
5, // 5 comments per minute
"Comment rate limit exceeded, please wait before posting more comments");
/**
 * Claim rate limiter
 * Limits claim operations
 */
exports.claimLimiter = createLimiter(60 * 1000, // 1 minute
10, // 10 claims per minute
"Claim rate limit exceeded, please wait before making more claims");
/**
 * Withdrawal rate limiter
 * Very strict for financial operations
 */
exports.withdrawalLimiter = createLimiter(60 * 60 * 1000, // 1 hour
5, // 5 withdrawals per hour
"Withdrawal rate limit exceeded, please try again later");
/**
 * Market creation rate limiter
 * Prevents market spam
 */
exports.marketCreationLimiter = createLimiter(60 * 60 * 1000, // 1 hour
10, // 10 markets per hour (fixed typo from 1000)
"Market creation rate limit exceeded, please try again later");
/**
 * Vote rate limiter
 * Limits voting operations
 */
exports.voteLimiter = createLimiter(60 * 1000, // 1 minute
20, // 20 votes per minute
"Vote rate limit exceeded, please slow down");
/**
 * Admin rate limiter
 * Very strict for admin operations to prevent brute force and DoS
 */
exports.adminLimiter = createLimiter(60 * 1000, // 1 minute
30, // 30 requests per minute (allows reasonable admin usage)
"Admin rate limit exceeded, please slow down");
//# sourceMappingURL=rateLimit.js.map