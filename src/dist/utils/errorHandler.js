"use strict";
/**
 * Safe error handler utility
 * Logs detailed errors server-side but returns generic messages to clients
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserErrorMessage = exports.isSafeError = exports.handleError = void 0;
/**
 * Handle errors safely - log details but return generic message
 */
const handleError = (error, context, defaultMessage = "An error occurred. Please try again later.") => {
    // Log the full error with context for debugging
    console.error(`[${context}] Error:`, {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        code: error?.code,
    });
    // Return generic message to client (never expose internal details)
    return {
        message: defaultMessage,
        logged: true,
    };
};
exports.handleError = handleError;
/**
 * Check if error is a known validation/input error that can be safely exposed
 */
const isSafeError = (error) => {
    // PostgreSQL error codes that are safe to expose
    const safeErrorCodes = [
        "23505", // unique_violation
        "23503", // foreign_key_violation
        "23502", // not_null_violation
        "22P02", // invalid_text_representation (invalid UUID, etc.)
        "23514", // check_violation
    ];
    // Check if it's a known validation error
    if (error?.code && safeErrorCodes.includes(error.code)) {
        return true;
    }
    // Check if error message indicates validation error
    if (error?.message) {
        const validationKeywords = [
            "validation",
            "invalid",
            "required",
            "missing",
            "format",
            "length",
            "range",
        ];
        const lowerMessage = error.message.toLowerCase();
        return validationKeywords.some((keyword) => lowerMessage.includes(keyword));
    }
    return false;
};
exports.isSafeError = isSafeError;
/**
 * Get user-friendly error message
 */
const getUserErrorMessage = (error, defaultMessage) => {
    // If it's a safe error, return the message
    if ((0, exports.isSafeError)(error)) {
        return error.message || defaultMessage;
    }
    // Otherwise return generic message
    return defaultMessage;
};
exports.getUserErrorMessage = getUserErrorMessage;
//# sourceMappingURL=errorHandler.js.map