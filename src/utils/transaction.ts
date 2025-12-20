import { PoolClient } from "pg";
import { pool } from "../db";
import { Response } from "express";

/**
 * Custom error class for transaction errors that should return HTTP responses
 */
export class TransactionError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "TransactionError";
  }
}

/**
 * Transaction helper to eliminate repetitive BEGIN/COMMIT/ROLLBACK code
 *
 * Throws TransactionError for early returns that should send HTTP responses.
 * Regular errors are re-thrown as-is.
 *
 * @example
 * await withTransaction(async (client) => {
 *   const market = await MarketModel.findById(marketId, client);
 *   if (!market) {
 *     throw new TransactionError(404, "Market not found");
 *   }
 *   await MarketModel.update(marketId, { status: 'RESOLVED' }, client);
 * });
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelayMs = 100, maxDelayMs = 2000 } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error: any) {
      await client.query("ROLLBACK");

      // Check if this is a deadlock error (PostgreSQL error code 40P01)
      const isDeadlock =
        error.code === "40P01" || error.message?.includes("deadlock detected");

      // Don't retry for TransactionError (business logic errors) or if we've exhausted retries
      if (!isDeadlock || attempt >= maxRetries) {
        throw error;
      }

      lastError = error;

      // Exponential backoff with jitter
      const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
      const jitter = Math.random() * 0.1 * delay; // 10% jitter
      const totalDelay = delay + jitter;

      console.warn(
        `Deadlock detected, retrying transaction in ${totalDelay.toFixed(
          0
        )}ms (attempt ${attempt + 1}/${maxRetries + 1})`
      );
      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    } finally {
      client.release();
    }
  }

  // This should never be reached, but just in case
  throw lastError;
}

/**
 * Transaction helper for Express route handlers
 * Automatically handles TransactionError and sends appropriate HTTP responses
 *
 * @example
 * return await withTransactionHandler(res, async (client) => {
 *   const market = await MarketModel.findById(marketId, client);
 *   if (!market) {
 *     throw new TransactionError(404, "Market not found");
 *   }
 *   return { market };
 * });
 */
export async function withTransactionHandler<T>(
  res: Response,
  callback: (client: PoolClient) => Promise<T>,
  options?: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  }
): Promise<void> {
  try {
    const result = await withTransaction(callback, options);
    if (result !== undefined) {
      res.status(200).send(result);
    }
  } catch (error: any) {
    if (error instanceof TransactionError) {
      res.status(error.statusCode).send({
        error: error.message,
        ...(error.details && { details: error.details }),
      });
    } else {
      console.error("Transaction error:", error);
      res.status(500).send({
        error: error.message || "Internal server error",
      });
    }
  }
}
