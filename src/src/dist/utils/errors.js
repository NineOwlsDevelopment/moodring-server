"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = sendError;
exports.sendSuccess = sendSuccess;
exports.sendValidationError = sendValidationError;
exports.sendNotFound = sendNotFound;
exports.sendUnauthorized = sendUnauthorized;
exports.sendForbidden = sendForbidden;
/**
 * Standard error response helper
 */
function sendError(res, statusCode, message, details) {
    res.status(statusCode).send({
        error: message,
        ...(details && { details }),
    });
}
/**
 * Standard success response helper
 */
function sendSuccess(res, data, statusCode = 200) {
    res.status(statusCode).send(data);
}
/**
 * Validation error helper
 */
function sendValidationError(res, message, field) {
    console.log("sendValidationError", message, field);
    sendError(res, 400, message, field ? { field } : undefined);
}
/**
 * Not found error helper
 */
function sendNotFound(res, resource) {
    console.log("sendNotFound", resource);
    sendError(res, 404, `${resource} not found`);
}
/**
 * Unauthorized error helper
 */
function sendUnauthorized(res, message) {
    console.log("sendUnauthorized", message);
    sendError(res, 403, message || "You are not authorized to perform this action");
}
/**
 * Forbidden error helper
 */
function sendForbidden(res, message) {
    console.log("sendForbidden", message);
    sendError(res, 403, message || "Access forbidden");
}
//# sourceMappingURL=errors.js.map