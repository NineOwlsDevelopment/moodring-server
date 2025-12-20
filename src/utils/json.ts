/**
 * JSON utilities to handle parsing/stringifying with consistent error handling
 */

/**
 * Safely parse JSON, returning null if invalid
 */
export function safeJsonParse<T = any>(
  json: string | null | undefined
): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Safely stringify JSON, returning null if invalid
 */
export function safeJsonStringify(value: any): string | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * Parse JSONB field from database, handling both string and already-parsed values
 */
export function parseJsonb<T = any>(value: any): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    return safeJsonParse<T>(value);
  }
  // Already parsed (PostgreSQL sometimes returns parsed JSONB)
  return value as T;
}

/**
 * Prepare value for JSONB storage
 */
export function prepareJsonb(value: any): string | null {
  return safeJsonStringify(value);
}
