import jwt from "jsonwebtoken";
import { secretsManager } from "./secrets";

// Lazy-loaded secrets to ensure secrets manager is initialized first
let JWT_SECRET: string | null = null;
let JWT_REFRESH_SECRET: string | null = null;

/**
 * Get JWT secret lazily (loads from secrets manager on first use)
 * This ensures secrets manager is initialized before secrets are accessed
 */
async function getJwtSecret(): Promise<string> {
  if (!JWT_SECRET) {
    JWT_SECRET = await secretsManager.getRequiredSecret("JWT_SECRET");
    if (!JWT_SECRET) {
      throw new Error(
        "JWT_SECRET not available from secrets manager or environment"
      );
    }
  }
  return JWT_SECRET;
}

/**
 * Get JWT refresh secret lazily
 */
async function getJwtRefreshSecret(): Promise<string> {
  if (!JWT_REFRESH_SECRET) {
    JWT_REFRESH_SECRET = await secretsManager.getRequiredSecret(
      "JWT_REFRESH_SECRET"
    );
    if (!JWT_REFRESH_SECRET) {
      throw new Error(
        "JWT_REFRESH_SECRET not available from secrets manager or environment"
      );
    }
  }
  return JWT_REFRESH_SECRET;
}

export interface JwtPayload {
  id: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Generate access token
 */
export const generateAccessToken = async (user: any): Promise<string> => {
  const payload: JwtPayload = {
    id: user.id,
  };

  const secret = await getJwtSecret();
  return jwt.sign(payload, secret, {
    expiresIn: process.env.ACCESS_TOKEN_EXP || "15m",
  } as jwt.SignOptions);
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = async (
  payload: JwtPayload
): Promise<string> => {
  const secret = await getJwtRefreshSecret();
  return jwt.sign(payload, secret, {
    expiresIn: process.env.REFRESH_TOKEN_EXP || "30d",
  } as jwt.SignOptions);
};

/**
 * Generate both access and refresh tokens
 */
export const generateTokenPair = async (
  payload: JwtPayload
): Promise<TokenPair> => {
  return {
    accessToken: await generateAccessToken(payload),
    refreshToken: await generateRefreshToken(payload),
  };
};

/**
 * Verify access token
 */
export const verifyAccessToken = async (token: string): Promise<JwtPayload> => {
  try {
    const secret = await getJwtSecret();
    return jwt.verify(token, secret) as JwtPayload;
  } catch (error) {
    throw new Error("Invalid or expired access token");
  }
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = async (
  token: string
): Promise<JwtPayload> => {
  try {
    const secret = await getJwtRefreshSecret();
    return jwt.verify(token, secret) as JwtPayload;
  } catch (error) {
    throw new Error("Invalid or expired refresh token");
  }
};

/**
 * Decode token without verification (useful for debugging)
 */
export const decodeToken = (token: string): JwtPayload | null => {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch (error) {
    return null;
  }
};
