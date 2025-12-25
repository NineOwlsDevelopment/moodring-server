"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationPreferencesSchema = exports.voteCommentSchema = exports.updateCommentSchema = exports.createCommentSchema = exports.withdrawalSchema = exports.validatePublicKey = exports.validateUUID = exports.validateParams = exports.validateQuery = exports.validateBody = void 0;
const web3_js_1 = require("@solana/web3.js");
/**
 * Validation middleware factory
 * Creates middleware that validates request body against a schema
 */
const validateBody = (schema) => {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.body);
            console.log("result", result);
            if (!result.success && result.error) {
                const formattedErrors = result.error.errors.map((err) => ({
                    field: err.path.join("."),
                    message: err.message,
                }));
                return res.status(400).json({
                    error: "Validation failed",
                    details: formattedErrors,
                });
            }
            req.body = result.data;
            console.log("req.body", req.body);
            next();
        }
        catch (error) {
            console.log(error);
            return res.status(400).json({
                error: "Invalid request body",
                message: error?.message || "Validation error",
            });
        }
    };
};
exports.validateBody = validateBody;
/**
 * Validates query parameters
 */
const validateQuery = (schema) => {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.query);
            if (!result.success && result.error) {
                const formattedErrors = result.error.errors.map((err) => ({
                    field: err.path.join("."),
                    message: err.message,
                }));
                return res.status(400).json({
                    error: "Invalid query parameters",
                    details: formattedErrors,
                });
            }
            req.query = result.data;
            next();
        }
        catch (error) {
            return res.status(400).json({
                error: "Invalid query parameters",
                message: error?.message || "Validation error",
            });
        }
    };
};
exports.validateQuery = validateQuery;
/**
 * Validates URL parameters
 */
const validateParams = (schema) => {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.params);
            if (!result.success && result.error) {
                const formattedErrors = result.error.errors.map((err) => ({
                    field: err.path.join("."),
                    message: err.message,
                }));
                return res.status(400).json({
                    error: "Invalid URL parameters",
                    details: formattedErrors,
                });
            }
            req.params = result.data;
            next();
        }
        catch (error) {
            return res.status(400).json({
                error: "Invalid URL parameters",
                message: error?.message || "Validation error",
            });
        }
    };
};
exports.validateParams = validateParams;
/**
 * UUID validation regex pattern
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/**
 * Middleware to validate UUID parameters
 */
const validateUUID = (paramName = "id") => {
    return (req, res, next) => {
        const value = req.params[paramName];
        if (!value) {
            return res.status(400).json({
                error: "Invalid request",
                message: `Missing required parameter: ${paramName}`,
            });
        }
        if (!UUID_REGEX.test(value)) {
            return res.status(400).json({
                error: "Invalid request",
                message: `Invalid UUID format for parameter: ${paramName}`,
            });
        }
        next();
    };
};
exports.validateUUID = validateUUID;
/**
 * Middleware to validate Solana public key
 */
const validatePublicKey = (paramName = "address") => {
    return (req, res, next) => {
        const value = req.body[paramName] || req.params[paramName] || req.query[paramName];
        if (!value) {
            return res.status(400).json({
                error: "Invalid request",
                message: `Missing required parameter: ${paramName}`,
            });
        }
        try {
            new web3_js_1.PublicKey(value);
            next();
        }
        catch (error) {
            return res.status(400).json({
                error: "Invalid request",
                message: `Invalid Solana public key format for parameter: ${paramName}`,
            });
        }
    };
};
exports.validatePublicKey = validatePublicKey;
// =====================================================
// Simple Validation Helper (without zod dependency)
// =====================================================
/**
 * Creates a simple validation schema
 * For full zod support, install zod: npm install zod
 */
const createSchema = (validator, errorMessage) => ({
    parse: (data) => {
        const result = validator(data);
        if (result === null)
            throw new Error(errorMessage);
        return result;
    },
    safeParse: (data) => {
        try {
            const result = validator(data);
            if (result === null) {
                return {
                    success: false,
                    error: { errors: [{ path: [], message: errorMessage }] },
                };
            }
            return { success: true, data: result };
        }
        catch (e) {
            return {
                success: false,
                error: { errors: [{ path: [], message: e.message }] },
            };
        }
    },
});
// Withdrawal schema - validates Solana address properly
exports.withdrawalSchema = createSchema((data) => {
    if (!data || typeof data !== "object")
        return null;
    if (!data.destination_address || typeof data.destination_address !== "string")
        return null;
    // Validate Solana public key format
    try {
        new web3_js_1.PublicKey(data.destination_address);
    }
    catch {
        return null;
    }
    if (typeof data.amount !== "number" || data.amount < 1)
        return null;
    if (!["SOL", "USDC"].includes(data.token_symbol))
        return null;
    return data;
}, "Invalid withdrawal data");
// Comment schemas
exports.createCommentSchema = createSchema((data) => {
    if (!data || typeof data !== "object")
        return null;
    if (!data.market_id || typeof data.market_id !== "string")
        return null;
    if (!data.content ||
        typeof data.content !== "string" ||
        data.content.length > 2000)
        return null;
    return data;
}, "Invalid comment data");
exports.updateCommentSchema = createSchema((data) => {
    if (!data || typeof data !== "object")
        return null;
    if (!data.content ||
        typeof data.content !== "string" ||
        data.content.length > 2000)
        return null;
    return data;
}, "Invalid comment update data");
exports.voteCommentSchema = createSchema((data) => {
    if (!data || typeof data !== "object")
        return null;
    if (!["up", "down"].includes(data.vote_type))
        return null;
    return data;
}, "vote_type must be 'up' or 'down'");
exports.notificationPreferencesSchema = createSchema((data) => {
    if (!data || typeof data !== "object")
        return null;
    return data;
}, "Invalid notification preferences");
//# sourceMappingURL=validate.js.map