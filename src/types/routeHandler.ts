import { RequestHandler, Request, Response } from "express";

/**
 * Type-safe route handler wrapper
 *
 * Converts a handler with a custom request type to Express's RequestHandler.
 * This maintains type safety while allowing compatibility with Express router.
 *
 * The handler should handle errors internally and send responses directly.
 * Express will catch any unhandled errors via its error handling middleware.
 *
 * Supports handlers that return void, Promise<void>, Response, or Promise<Response>.
 *
 * @example
 * router.get("/", typedHandler(getNotifications));
 */
export function typedHandler<TRequest extends Request = Request>(
  handler: (
    req: TRequest,
    res: Response
  ) => Promise<void | Response> | void | Response
): RequestHandler {
  return (req: Request, res: Response, next) => {
    // Execute handler and let Express handle any uncaught errors
    Promise.resolve(handler(req as TRequest, res)).catch(next);
  };
}
