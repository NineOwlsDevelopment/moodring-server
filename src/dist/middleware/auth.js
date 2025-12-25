"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authenticateToken = void 0;
const jwt_1 = require("../utils/jwt");
const revocation_1 = require("../utils/revocation");
/**
 * Middleware to authenticate JWT tokens
 * Expects token in Authorization header as "Bearer <token>"
 * Also checks if the token has been revoked
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"];
        let token = authHeader && authHeader.split(" ")[1];
        !token && (token = req.cookies?.accessToken);
        if (!token) {
            res.status(401).send({
                error: "Access token required",
                message: "Please provide a valid access token",
            });
            return;
        }
        // Verify JWT token signature and expiration
        const payload = await (0, jwt_1.verifyAccessToken)(token);
        // Check if token has been revoked
        const isRevoked = await (0, revocation_1.isTokenRevoked)(token);
        if (isRevoked) {
            res.status(401).send({
                error: "Token revoked",
                message: "This token has been revoked. Please login again.",
            });
            return;
        }
        req.id = payload.id;
        next();
    }
    catch (error) {
        res.status(401).send({
            error: "Invalid token",
            message: error instanceof Error ? error.message : "Token verification failed",
        });
        return;
    }
};
exports.authenticateToken = authenticateToken;
/**
 * Optional authentication middleware
 * Attaches user if token is valid but doesn't block if invalid/missing
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"];
        const token = authHeader && authHeader.split(" ")[1];
        if (token) {
            try {
                const payload = await (0, jwt_1.verifyAccessToken)(token);
                // Check if token is revoked (but don't block if it is)
                const isRevoked = await (0, revocation_1.isTokenRevoked)(token);
                if (!isRevoked) {
                    req.id = payload.id;
                }
            }
            catch (error) {
                // Silently fail for optional auth
            }
        }
    }
    catch (error) {
        // Silently fail for optional auth
        console.log("Optional auth failed:", error);
    }
    next();
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map