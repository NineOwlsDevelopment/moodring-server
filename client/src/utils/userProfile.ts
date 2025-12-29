/**
 * Utility functions for user profile links
 */

/**
 * Generate a user profile URL from either username or user ID
 * Supports both formats: /user/username or /user/uuid
 */
export const getUserProfileUrl = (identifier: string | null | undefined): string => {
  if (!identifier) return "#";
  return `/user/${identifier}`;
};

/**
 * Check if a string is a UUID
 */
export const isUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

