import jwt from "jsonwebtoken";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not defined");
}

if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error("JWT_REFRESH_SECRET environment variable is not defined");
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

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
export const generateAccessToken = (user: any): string => {
  const payload: JwtPayload = {
    id: user.id,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXP || "15m",
  } as jwt.SignOptions);
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXP || "30d",
  } as jwt.SignOptions);
};

/**
 * Generate both access and refresh tokens
 */
export const generateTokenPair = (payload: JwtPayload): TokenPair => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    throw new Error("Invalid or expired access token");
  }
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
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
