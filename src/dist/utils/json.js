"use strict";
/**
 * JSON utilities to handle parsing/stringifying with consistent error handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeJsonParse = safeJsonParse;
exports.safeJsonStringify = safeJsonStringify;
exports.parseJsonb = parseJsonb;
exports.prepareJsonb = prepareJsonb;
/**
 * Safely parse JSON, returning null if invalid
 */
function safeJsonParse(json) {
    if (!json)
        return null;
    try {
        return JSON.parse(json);
    }
    catch {
        return null;
    }
}
/**
 * Safely stringify JSON, returning null if invalid
 */
function safeJsonStringify(value) {
    if (value === null || value === undefined)
        return null;
    try {
        return JSON.stringify(value);
    }
    catch {
        return null;
    }
}
/**
 * Parse JSONB field from database, handling both string and already-parsed values
 */
function parseJsonb(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === "string") {
        return safeJsonParse(value);
    }
    // Already parsed (PostgreSQL sometimes returns parsed JSONB)
    return value;
}
/**
 * Prepare value for JSONB storage
 */
function prepareJsonb(value) {
    return safeJsonStringify(value);
}
//# sourceMappingURL=json.js.map