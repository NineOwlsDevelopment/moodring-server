/**
 * Safe error handler utility
 * Logs detailed errors server-side but returns generic messages to clients
 */

/**
 * Handle errors safely - log details but return generic message
 */
export const handleError = (
  error: any,
  context: string,
  defaultMessage: string = "An error occurred. Please try again later."
): { message: string; logged: boolean } => {
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

/**
 * Check if error is a known validation/input error that can be safely exposed
 */
export const isSafeError = (error: any): boolean => {
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

/**
 * Get user-friendly error message
 */
export const getUserErrorMessage = (
  error: any,
  defaultMessage: string
): string => {
  // If it's a safe error, return the message
  if (isSafeError(error)) {
    return error.message || defaultMessage;
  }

  // Otherwise return generic message
  return defaultMessage;
};
