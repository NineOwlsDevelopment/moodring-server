"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupExpiredRevokedTokens = exports.isTokenRevoked = exports.revokeToken = exports.getTokenExpiration = exports.hashToken = void 0;
exports.initializeRevocationCache = initializeRevocationCache;
const db_1 = require("../db");
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Redis client for revocation cache (optional, falls back to database)
let redisClient = null;
/**
 * Initialize Redis client for revocation cache (optional)
 * SECURITY FIX: Provides O(1) lookup for token revocation checks
 */
async function initializeRevocationCache() {
    try {
        const redis = require("redis");
        const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
        // Redis v5 automatically handles cluster mode when connecting to cluster endpoints
        redisClient = redis.createClient({ url: redisUrl });
        await redisClient.connect();
        console.log("✅ Redis revocation cache initialized");
    }
    catch (error) {
        console.warn("⚠️  Redis not available for revocation cache, using database only");
        redisClient = null;
    }
}
/**
 * Hash a JWT token for storage (we don't store the full token for security)
 */
const hashToken = (token) => {
    return crypto_1.default.createHash("sha256").update(token).digest("hex");
};
exports.hashToken = hashToken;
/**
 * Get expiration time from a JWT token
 */
const getTokenExpiration = (token) => {
    try {
        const decoded = jsonwebtoken_1.default.decode(token);
        if (decoded && decoded.exp) {
            return new Date(decoded.exp * 1000);
        }
        return null;
    }
    catch (error) {
        return null;
    }
};
exports.getTokenExpiration = getTokenExpiration;
/**
 * Revoke a JWT token (access or refresh)
 * SECURITY FIX: Writes to both Redis (fast) and database (persistent)
 */
const revokeToken = async (token, userId, tokenType) => {
    const tokenHash = (0, exports.hashToken)(token);
    const expiresAtDate = (0, exports.getTokenExpiration)(token);
    if (!expiresAtDate) {
        throw new Error("Invalid token: cannot determine expiration");
    }
    // Convert Date to Unix timestamp (seconds)
    const expiresAt = Math.floor(expiresAtDate.getTime() / 1000);
    const revokedAt = Math.floor(Date.now() / 1000);
    // SECURITY FIX: Write to Redis first (fast, for immediate revocation)
    if (redisClient) {
        try {
            const ttl = Math.max(0, expiresAt - revokedAt); // TTL in seconds
            if (ttl > 0) {
                await redisClient.setEx(`revoked:${tokenHash}`, ttl, JSON.stringify({ userId, tokenType, expiresAt, revokedAt }));
            }
        }
        catch (error) {
            console.error("Redis revocation write failed, continuing with database:", error);
        }
    }
    // Write to database (persistent, with conflict handling)
    await db_1.pool.query(`INSERT INTO jwt_revoked_tokens (token_hash, user_id, token_type, expires_at, revoked_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (token_hash) DO UPDATE SET
       revoked_at = EXCLUDED.revoked_at`, [tokenHash, userId, tokenType, expiresAt, revokedAt]);
};
exports.revokeToken = revokeToken;
/**
 * Check if a token is revoked
 * SECURITY FIX: Checks Redis first (O(1) lookup), falls back to database
 */
const isTokenRevoked = async (token) => {
    const tokenHash = (0, exports.hashToken)(token);
    // SECURITY FIX: Check Redis first (fast path)
    if (redisClient) {
        try {
            const cached = await redisClient.get(`revoked:${tokenHash}`);
            if (cached !== null) {
                return true; // Token is revoked (found in cache)
            }
        }
        catch (error) {
            // Redis error, fall back to database
            console.warn("Redis revocation check failed, using database:", error);
        }
    }
    // Fall back to database (with index for fast lookup)
    const result = await db_1.pool.query(`SELECT 1 FROM jwt_revoked_tokens 
     WHERE token_hash = $1 
     AND expires_at > EXTRACT(EPOCH FROM NOW())::BIGINT
     LIMIT 1`, [tokenHash]);
    return result.rows.length > 0;
};
exports.isTokenRevoked = isTokenRevoked;
/**
 * Clean up expired revoked tokens (should be run periodically via cron)
 * SECURITY FIX: Redis keys expire automatically via TTL, but we clean database
 */
const cleanupExpiredRevokedTokens = async () => {
    // Clean up Redis (automatic via TTL, but manual cleanup for safety)
    if (redisClient) {
        try {
            // Redis keys expire automatically, but we can scan for expired keys
            // This is optional - TTL handles most cleanup
        }
        catch (error) {
            console.error("Redis cleanup failed:", error);
        }
    }
    // Clean up database
    const result = await db_1.pool.query(`DELETE FROM jwt_revoked_tokens 
     WHERE expires_at < EXTRACT(EPOCH FROM NOW())::BIGINT`);
    return result.rowCount || 0;
};
exports.cleanupExpiredRevokedTokens = cleanupExpiredRevokedTokens;
//# sourceMappingURL=revocation.js.map