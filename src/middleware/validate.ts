import { Request, Response, NextFunction } from "express";
import { PublicKey } from "@solana/web3.js";

// Simple validation types (zod optional - can install via npm install zod)
interface ValidationError {
  field: string;
  message: string;
}

interface ValidationSchema<T> {
  parse: (data: unknown) => T;
  safeParse: (data: unknown) => {
    success: boolean;
    data?: T;
    error?: { errors: Array<{ path: string[]; message: string }> };
  };
}

/**
 * Validation middleware factory
 * Creates middleware that validates request body against a schema
 */
export const validateBody = <T>(schema: ValidationSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      console.log("result", result);

      if (!result.success && result.error) {
        const formattedErrors: ValidationError[] = result.error.errors.map(
          (err: any) => ({
            field: err.path.join("."),
            message: err.message,
          })
        );

        return res.status(400).json({
          error: "Validation failed",
          details: formattedErrors,
        });
      }
      req.body = result.data;
      console.log("req.body", req.body);
      next();
    } catch (error: any) {
      console.log(error);
      return res.status(400).json({
        error: "Invalid request body",
        message: error?.message || "Validation error",
      });
    }
  };
};

/**
 * Validates query parameters
 */
export const validateQuery = <T>(schema: ValidationSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query);
      if (!result.success && result.error) {
        const formattedErrors: ValidationError[] = result.error.errors.map(
          (err: any) => ({
            field: err.path.join("."),
            message: err.message,
          })
        );

        return res.status(400).json({
          error: "Invalid query parameters",
          details: formattedErrors,
        });
      }
      req.query = result.data as any;
      next();
    } catch (error: any) {
      return res.status(400).json({
        error: "Invalid query parameters",
        message: error?.message || "Validation error",
      });
    }
  };
};

/**
 * Validates URL parameters
 */
export const validateParams = <T>(schema: ValidationSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.params);
      if (!result.success && result.error) {
        const formattedErrors: ValidationError[] = result.error.errors.map(
          (err: any) => ({
            field: err.path.join("."),
            message: err.message,
          })
        );

        return res.status(400).json({
          error: "Invalid URL parameters",
          details: formattedErrors,
        });
      }
      req.params = result.data as any;
      next();
    } catch (error: any) {
      return res.status(400).json({
        error: "Invalid URL parameters",
        message: error?.message || "Validation error",
      });
    }
  };
};

/**
 * UUID validation regex pattern
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Middleware to validate UUID parameters
 */
export const validateUUID = (paramName: string = "id") => {
  return (req: Request, res: Response, next: NextFunction) => {
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

/**
 * Middleware to validate Solana public key
 */
export const validatePublicKey = (paramName: string = "address") => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value =
      req.body[paramName] || req.params[paramName] || req.query[paramName];

    if (!value) {
      return res.status(400).json({
        error: "Invalid request",
        message: `Missing required parameter: ${paramName}`,
      });
    }

    try {
      new PublicKey(value);
      next();
    } catch (error) {
      return res.status(400).json({
        error: "Invalid request",
        message: `Invalid Solana public key format for parameter: ${paramName}`,
      });
    }
  };
};

// =====================================================
// Simple Validation Helper (without zod dependency)
// =====================================================

/**
 * Creates a simple validation schema
 * For full zod support, install zod: npm install zod
 */
const createSchema = <T>(
  validator: (data: unknown) => T | null,
  errorMessage: string
) => ({
  parse: (data: unknown): T => {
    const result = validator(data);
    if (result === null) throw new Error(errorMessage);
    return result;
  },
  safeParse: (data: unknown) => {
    try {
      const result = validator(data);
      if (result === null) {
        return {
          success: false,
          error: { errors: [{ path: [], message: errorMessage }] },
        };
      }
      return { success: true, data: result };
    } catch (e: any) {
      return {
        success: false,
        error: { errors: [{ path: [], message: e.message }] },
      };
    }
  },
});

// Withdrawal schema - validates Solana address properly
export const withdrawalSchema = createSchema((data: any) => {
  if (!data || typeof data !== "object") return null;
  if (!data.destination_address || typeof data.destination_address !== "string")
    return null;

  // Validate Solana public key format
  try {
    new PublicKey(data.destination_address);
  } catch {
    return null;
  }

  if (typeof data.amount !== "number" || data.amount < 1) return null;
  if (!["SOL", "USDC"].includes(data.token_symbol)) return null;
  return data as {
    destination_address: string;
    amount: number;
    token_symbol: "SOL" | "USDC";
  };
}, "Invalid withdrawal data");

// Comment schemas
export const createCommentSchema = createSchema((data: any) => {
  if (!data || typeof data !== "object") return null;
  if (!data.market_id || typeof data.market_id !== "string") return null;
  if (
    !data.content ||
    typeof data.content !== "string" ||
    data.content.length > 2000
  )
    return null;
  return data;
}, "Invalid comment data");

export const updateCommentSchema = createSchema((data: any) => {
  if (!data || typeof data !== "object") return null;
  if (
    !data.content ||
    typeof data.content !== "string" ||
    data.content.length > 2000
  )
    return null;
  return data;
}, "Invalid comment update data");

export const voteCommentSchema = createSchema((data: any) => {
  if (!data || typeof data !== "object") return null;
  if (!["up", "down"].includes(data.vote_type)) return null;
  return data as { vote_type: "up" | "down" };
}, "vote_type must be 'up' or 'down'");

export const notificationPreferencesSchema = createSchema((data: any) => {
  if (!data || typeof data !== "object") return null;
  return data;
}, "Invalid notification preferences");
