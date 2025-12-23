import { Response } from "express";

/**
 * Standard error response helper
 */
export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  details?: any
): void {
  res.status(statusCode).send({
    error: message,
    ...(details && { details }),
  });
}

/**
 * Standard success response helper
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200
): void {
  res.status(statusCode).send(data);
}

/**
 * Validation error helper
 */
export function sendValidationError(
  res: Response,
  message: string,
  field?: string
): void {
  console.log("sendValidationError", message, field);
  sendError(res, 400, message, field ? { field } : undefined);
}

/**
 * Not found error helper
 */
export function sendNotFound(res: Response, resource: string): void {
  console.log("sendNotFound", resource);
  sendError(res, 404, `${resource} not found`);
}

/**
 * Unauthorized error helper
 */
export function sendUnauthorized(res: Response, message?: string): void {
  console.log("sendUnauthorized", message);
  sendError(
    res,
    403,
    message || "You are not authorized to perform this action"
  );
}

/**
 * Forbidden error helper
 */
export function sendForbidden(res: Response, message?: string): void {
  console.log("sendForbidden", message);
  sendError(res, 403, message || "Access forbidden");
}
