import { pool } from "../db";
import crypto from "crypto";
import jwt from "jsonwebtoken";

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

  // Only insert if not already revoked (handle duplicate revocation gracefully)
  await pool.query(
    `INSERT INTO jwt_revoked_tokens (token_hash, user_id, token_type, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (token_hash) DO NOTHING`,
    [tokenHash, userId, tokenType, expiresAt]
  );
};

/**
 * Check if a token is revoked
 */
export const isTokenRevoked = async (token: string): Promise<boolean> => {
  const tokenHash = hashToken(token);

  const result = await pool.query(
    `SELECT 1 FROM jwt_revoked_tokens 
     WHERE token_hash = $1 
     AND expires_at > EXTRACT(EPOCH FROM NOW())::BIGINT`,
    [tokenHash]
  );

  return result.rows.length > 0;
};

/**
 * Clean up expired revoked tokens (should be run periodically via cron)
 */
export const cleanupExpiredRevokedTokens = async (): Promise<number> => {
  const result = await pool.query(
    `DELETE FROM jwt_revoked_tokens 
     WHERE expires_at < EXTRACT(EPOCH FROM NOW())::BIGINT`
  );

  return result.rowCount || 0;
};
