import { pool } from "../db";
import crypto from "crypto";
import jwt from "jsonwebtoken";

// Redis client for revocation cache (optional, falls back to database)
let redisClient: any = null;

/**
 * Initialize Redis client for revocation cache (optional)
 * SECURITY FIX: Provides O(1) lookup for token revocation checks
 */
export async function initializeRevocationCache(): Promise<void> {
  try {
    const redis = require("redis");
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    // Redis v5 automatically handles cluster mode when connecting to cluster endpoints
    redisClient = redis.createClient({ url: redisUrl });
    await redisClient.connect();
    console.log("✅ Redis revocation cache initialized");
  } catch (error) {
    console.warn(
      "⚠️  Redis not available for revocation cache, using database only"
    );
    redisClient = null;
  }
}

/**
 * Hash a JWT token for storage (we don't store the full token for security)
 */
export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Get expiration time from a JWT token
 */
export const getTokenExpiration = (token: string): Date | null => {
  try {
    const decoded = jwt.decode(token) as jwt.JwtPayload | null;
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Revoke a JWT token (access or refresh)
 * SECURITY FIX: Writes to both Redis (fast) and database (persistent)
 */
export const revokeToken = async (
  token: string,
  userId: string,
  tokenType: "access" | "refresh"
): Promise<void> => {
  const tokenHash = hashToken(token);
  const expiresAtDate = getTokenExpiration(token);

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
        await redisClient.setEx(
          `revoked:${tokenHash}`,
          ttl,
          JSON.stringify({ userId, tokenType, expiresAt, revokedAt })
        );
      }
    } catch (error) {
      console.error(
        "Redis revocation write failed, continuing with database:",
        error
      );
    }
  }

  // Write to database (persistent, with conflict handling)
  await pool.query(
    `INSERT INTO jwt_revoked_tokens (token_hash, user_id, token_type, expires_at, revoked_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (token_hash) DO UPDATE SET
       revoked_at = EXCLUDED.revoked_at,
       updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT`,
    [tokenHash, userId, tokenType, expiresAt, revokedAt]
  );
};

/**
 * Check if a token is revoked
 * SECURITY FIX: Checks Redis first (O(1) lookup), falls back to database
 */
export const isTokenRevoked = async (token: string): Promise<boolean> => {
  const tokenHash = hashToken(token);

  // SECURITY FIX: Check Redis first (fast path)
  if (redisClient) {
    try {
      const cached = await redisClient.get(`revoked:${tokenHash}`);
      if (cached !== null) {
        return true; // Token is revoked (found in cache)
      }
    } catch (error) {
      // Redis error, fall back to database
      console.warn("Redis revocation check failed, using database:", error);
    }
  }

  // Fall back to database (with index for fast lookup)
  const result = await pool.query(
    `SELECT 1 FROM jwt_revoked_tokens 
     WHERE token_hash = $1 
     AND expires_at > EXTRACT(EPOCH FROM NOW())::BIGINT
     LIMIT 1`,
    [tokenHash]
  );

  return result.rows.length > 0;
};

/**
 * Clean up expired revoked tokens (should be run periodically via cron)
 * SECURITY FIX: Redis keys expire automatically via TTL, but we clean database
 */
export const cleanupExpiredRevokedTokens = async (): Promise<number> => {
  // Clean up Redis (automatic via TTL, but manual cleanup for safety)
  if (redisClient) {
    try {
      // Redis keys expire automatically, but we can scan for expired keys
      // This is optional - TTL handles most cleanup
    } catch (error) {
      console.error("Redis cleanup failed:", error);
    }
  }

  // Clean up database
  const result = await pool.query(
    `DELETE FROM jwt_revoked_tokens 
     WHERE expires_at < EXTRACT(EPOCH FROM NOW())::BIGINT`
  );

  return result.rowCount || 0;
};
