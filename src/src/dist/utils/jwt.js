"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeToken = exports.verifyRefreshToken = exports.verifyAccessToken = exports.generateTokenPair = exports.generateRefreshToken = exports.generateAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const secrets_1 = require("./secrets");
// Lazy-loaded secrets to ensure secrets manager is initialized first
let JWT_SECRET = null;
let JWT_REFRESH_SECRET = null;
/**
 * Get JWT secret lazily (loads from secrets manager on first use)
 * This ensures secrets manager is initialized before secrets are accessed
 */
async function getJwtSecret() {
    if (!JWT_SECRET) {
        JWT_SECRET = await secrets_1.secretsManager.getRequiredSecret("JWT_SECRET");
        if (!JWT_SECRET) {
            throw new Error("JWT_SECRET not available from secrets manager or environment");
        }
    }
    return JWT_SECRET;
}
/**
 * Get JWT refresh secret lazily
 */
async function getJwtRefreshSecret() {
    if (!JWT_REFRESH_SECRET) {
        JWT_REFRESH_SECRET = await secrets_1.secretsManager.getRequiredSecret("JWT_REFRESH_SECRET");
        if (!JWT_REFRESH_SECRET) {
            throw new Error("JWT_REFRESH_SECRET not available from secrets manager or environment");
        }
    }
    return JWT_REFRESH_SECRET;
}
/**
 * Generate access token
 */
const generateAccessToken = async (user) => {
    const payload = {
        id: user.id,
    };
    const secret = await getJwtSecret();
    return jsonwebtoken_1.default.sign(payload, secret, {
        expiresIn: process.env.ACCESS_TOKEN_EXP || "15m",
    });
};
exports.generateAccessToken = generateAccessToken;
/**
 * Generate refresh token
 */
const generateRefreshToken = async (payload) => {
    const secret = await getJwtRefreshSecret();
    return jsonwebtoken_1.default.sign(payload, secret, {
        expiresIn: process.env.REFRESH_TOKEN_EXP || "30d",
    });
};
exports.generateRefreshToken = generateRefreshToken;
/**
 * Generate both access and refresh tokens
 */
const generateTokenPair = async (payload) => {
    return {
        accessToken: await (0, exports.generateAccessToken)(payload),
        refreshToken: await (0, exports.generateRefreshToken)(payload),
    };
};
exports.generateTokenPair = generateTokenPair;
/**
 * Verify access token
 */
const verifyAccessToken = async (token) => {
    try {
        const secret = await getJwtSecret();
        return jsonwebtoken_1.default.verify(token, secret);
    }
    catch (error) {
        throw new Error("Invalid or expired access token");
    }
};
exports.verifyAccessToken = verifyAccessToken;
/**
 * Verify refresh token
 */
const verifyRefreshToken = async (token) => {
    try {
        const secret = await getJwtRefreshSecret();
        return jsonwebtoken_1.default.verify(token, secret);
    }
    catch (error) {
        throw new Error("Invalid or expired refresh token");
    }
};
exports.verifyRefreshToken = verifyRefreshToken;
/**
 * Decode token without verification (useful for debugging)
 */
const decodeToken = (token) => {
    try {
        return jsonwebtoken_1.default.decode(token);
    }
    catch (error) {
        return null;
    }
};
exports.decodeToken = decodeToken;
//# sourceMappingURL=jwt.js.map