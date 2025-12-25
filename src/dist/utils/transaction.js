"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionError = void 0;
exports.withTransaction = withTransaction;
exports.withTransactionHandler = withTransactionHandler;
const db_1 = require("../db");
/**
 * Custom error class for transaction errors that should return HTTP responses
 */
class TransactionError extends Error {
    constructor(statusCode, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = "TransactionError";
    }
}
exports.TransactionError = TransactionError;
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
async function withTransaction(callback, options = {}) {
    const { maxRetries = 3, initialDelayMs = 100, maxDelayMs = 2000 } = options;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const client = await db_1.pool.connect();
        try {
            await client.query("BEGIN");
            const result = await callback(client);
            await client.query("COMMIT");
            return result;
        }
        catch (error) {
            await client.query("ROLLBACK");
            // Check if this is a deadlock error (PostgreSQL error code 40P01)
            const isDeadlock = error.code === "40P01" || error.message?.includes("deadlock detected");
            // Don't retry for TransactionError (business logic errors) or if we've exhausted retries
            if (!isDeadlock || attempt >= maxRetries) {
                throw error;
            }
            lastError = error;
            // Exponential backoff with jitter
            const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
            const jitter = Math.random() * 0.1 * delay; // 10% jitter
            const totalDelay = delay + jitter;
            console.warn(`Deadlock detected, retrying transaction in ${totalDelay.toFixed(0)}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
            await new Promise((resolve) => setTimeout(resolve, totalDelay));
        }
        finally {
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
async function withTransactionHandler(res, callback, options) {
    try {
        const result = await withTransaction(callback, options);
        if (result !== undefined) {
            res.status(200).send(result);
        }
    }
    catch (error) {
        if (error instanceof TransactionError) {
            res.status(error.statusCode).send({
                error: error.message,
                ...(error.details && { details: error.details }),
            });
        }
        else {
            console.error("Transaction error:", error);
            res.status(500).send({
                error: error.message || "Internal server error",
            });
        }
    }
}
//# sourceMappingURL=transaction.js.map