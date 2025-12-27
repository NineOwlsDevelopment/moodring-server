"use strict";
/**
 * Validation utilities to centralize common validation logic
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequired = validateRequired;
exports.validateNumber = validateNumber;
exports.validateLength = validateLength;
exports.validateEnum = validateEnum;
exports.validateFields = validateFields;
exports.validateUrl = validateUrl;
exports.validateDataSourceValue = validateDataSourceValue;
/**
 * Validate that a value is not null/undefined/empty
 */
function validateRequired(value, fieldName) {
    if (value === null || value === undefined || value === "") {
        return {
            isValid: false,
            error: `${fieldName} is required`,
        };
    }
    return { isValid: true };
}
/**
 * Validate that a value is a valid number
 */
function validateNumber(value, fieldName, min, max) {
    if (value === null || value === undefined) {
        return {
            isValid: false,
            error: `${fieldName} is required`,
        };
    }
    const num = Number(value);
    if (isNaN(num)) {
        return {
            isValid: false,
            error: `${fieldName} must be a valid number`,
        };
    }
    if (min !== undefined && num < min) {
        return {
            isValid: false,
            error: `${fieldName} must be at least ${min}`,
        };
    }
    if (max !== undefined && num > max) {
        return {
            isValid: false,
            error: `${fieldName} must be at most ${max}`,
        };
    }
    return { isValid: true };
}
/**
 * Validate string length
 */
function validateLength(value, fieldName, min, max) {
    if (value === null || value === undefined) {
        return {
            isValid: false,
            error: `${fieldName} is required`,
        };
    }
    const len = value.length;
    if (min !== undefined && len < min) {
        return {
            isValid: false,
            error: `${fieldName} must be at least ${min} characters`,
        };
    }
    if (max !== undefined && len > max) {
        return {
            isValid: false,
            error: `${fieldName} must be at most ${max} characters`,
        };
    }
    return { isValid: true };
}
/**
 * Validate that a value is in a list of allowed values
 */
function validateEnum(value, fieldName, allowedValues) {
    if (!allowedValues.includes(value)) {
        return {
            isValid: false,
            error: `${fieldName} must be one of: ${allowedValues.join(", ")}`,
        };
    }
    return { isValid: true };
}
/**
 * Validate multiple fields at once
 */
function validateFields(validations) {
    for (const validation of validations) {
        if (!validation.isValid) {
            return validation;
        }
    }
    return { isValid: true };
}
/**
 * Validate URL to prevent malicious inputs
 */
function validateUrl(value) {
    if (!value || typeof value !== "string") {
        return {
            isValid: false,
            error: "URL must be a non-empty string",
        };
    }
    // Check for dangerous patterns
    const dangerousPatterns = [
        /javascript:/i,
        /data:text\/html/i,
        /vbscript:/i,
        /on\w+\s*=/i, // Event handlers like onclick=
        /<script/i,
        /<\/script>/i,
        /eval\(/i,
        /expression\(/i,
    ];
    for (const pattern of dangerousPatterns) {
        if (pattern.test(value)) {
            return {
                isValid: false,
                error: "URL contains potentially malicious content",
            };
        }
    }
    // Validate URL format (must start with http://, https://, or be a blockchain address)
    const urlPattern = /^(https?:\/\/|solana:|ethereum:|0x[a-fA-F0-9]{40}|[A-Za-z0-9]{32,44})/;
    if (!urlPattern.test(value.trim())) {
        return {
            isValid: false,
            error: "URL must be a valid HTTP/HTTPS URL or blockchain address",
        };
    }
    // Check length
    if (value.length > 2048) {
        return {
            isValid: false,
            error: "URL must be 2048 characters or less",
        };
    }
    return { isValid: true };
}
/**
 * Validate data source value - allows any value, only checks length
 * SQL injection is prevented by parameterized queries, so no need to validate SQL patterns
 */
function validateDataSourceValue(type, value) {
    if (!value || typeof value !== "string" || !value.trim()) {
        return {
            isValid: false,
            error: "Data source value is required and must be non-empty",
        };
    }
    const trimmedValue = value.trim();
    // Check length limit
    if (trimmedValue.length > 2048) {
        return {
            isValid: false,
            error: "Data source value must be 2048 characters or less",
        };
    }
    // No other validation needed - parameterized queries protect against SQL injection
    // Data sources are stored as JSONB which is safe
    return { isValid: true };
}
//# sourceMappingURL=validation.js.map