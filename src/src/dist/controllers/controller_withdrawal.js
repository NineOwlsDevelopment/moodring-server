"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWithdrawalTotals = exports.getWithdrawal = exports.getWithdrawalHistory = exports.cancelWithdrawal = exports.requestWithdrawal = void 0;
const web3_js_1 = require("@solana/web3.js");
const crypto_1 = __importDefault(require("crypto"));
const Withdrawal_1 = require("../models/Withdrawal");
const circleWallet_1 = require("../services/circleWallet");
const transaction_1 = require("../utils/transaction");
const withdrawalQueue_1 = require("../services/withdrawalQueue");
const errors_1 = require("../utils/errors");
const validation_1 = require("../utils/validation");
const db_1 = require("../db");
/**
 * Hash user ID for advisory lock (consistent hash function)
 * SECURITY FIX: Used to prevent concurrent withdrawals for same user
 */
function hashUserId(userId) {
    // Use first 8 bytes of SHA256 hash as 64-bit integer for advisory lock
    const hash = crypto_1.default.createHash("sha256").update(userId).digest();
    // Convert first 8 bytes to signed 64-bit integer
    // PostgreSQL advisory locks use signed bigint
    const buffer = Buffer.allocUnsafe(8);
    hash.copy(buffer, 0, 0, 8);
    // Use BigInt to handle large numbers, then convert to number
    // Note: This may lose precision for very large hashes, but is acceptable for lock IDs
    const lockId = buffer.readBigInt64BE(0);
    // PostgreSQL advisory locks work with 64-bit signed integers
    // We use modulo to ensure it fits in safe JavaScript number range
    return Number(lockId % BigInt(Number.MAX_SAFE_INTEGER));
}
/**
 * @route POST /api/withdrawal/request
 * @desc Request a USDC withdrawal using Circle API (prevents double-spending with idempotency)
 * @access Private
 */
const requestWithdrawal = async (req, res) => {
    try {
        const userId = req.id;
        const { destination_address, amount } = req.body;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        // Validate destination address
        try {
            new web3_js_1.PublicKey(destination_address);
        }
        catch {
            return (0, errors_1.sendValidationError)(res, "Invalid destination address");
        }
        // Validate amount
        const amountValidation = (0, validation_1.validateNumber)(amount, "Amount", 0.01, undefined);
        if (!amountValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, amountValidation.error);
        }
        // SECURITY FIX: Use precise arithmetic to prevent precision manipulation
        // Convert to micro-USDC (integer) to avoid JavaScript number precision issues
        const amountStr = String(amount);
        const decimalIndex = amountStr.indexOf(".");
        let parsedAmount;
        if (decimalIndex === -1) {
            // No decimal point, treat as whole USDC
            parsedAmount = Math.floor(Number(amountStr)) * 1000000;
        }
        else {
            // Has decimal point, parse carefully
            const wholePart = amountStr.substring(0, decimalIndex);
            const decimalPart = amountStr.substring(decimalIndex + 1);
            // Validate decimal part doesn't exceed 6 digits (USDC has 6 decimals)
            if (decimalPart.length > 6) {
                return (0, errors_1.sendValidationError)(res, "Amount precision error. USDC supports up to 6 decimal places.");
            }
            // Convert to micro-USDC: whole * 1M + decimal * 10^(6 - decimal.length)
            const wholeMicro = Math.floor(Number(wholePart)) * 1000000;
            const decimalMicro = Math.floor(Number(decimalPart) * Math.pow(10, 6 - decimalPart.length));
            parsedAmount = wholeMicro + decimalMicro;
        }
        // Validate precision: reconstruct amount and compare
        const reconstructed = parsedAmount / 1000000;
        const inputNum = Number(amount);
        const precisionDiff = Math.abs(reconstructed - inputNum);
        // Allow small floating point errors (1 micro-USDC = 0.000001 USDC)
        if (precisionDiff > 0.000001) {
            return (0, errors_1.sendValidationError)(res, "Amount precision error. Please use up to 6 decimal places.");
        }
        // Maximum withdrawal limit (1M USDC = 1,000,000,000,000 micro-USDC)
        const MAX_WITHDRAWAL = 1000000000000;
        if (parsedAmount > MAX_WITHDRAWAL) {
            return (0, errors_1.sendValidationError)(res, `Maximum withdrawal amount is ${MAX_WITHDRAWAL / 1000000} USDC`);
        }
        // Minimum withdrawal (already validated by validateNumber, but ensure in micro-units)
        if (parsedAmount < 10000) {
            // 0.01 USDC minimum
            return (0, errors_1.sendValidationError)(res, "Minimum withdrawal amount is 0.01 USDC");
        }
        const circleWallet = (0, circleWallet_1.getCircleWallet)();
        if (!circleWallet.isAvailable()) {
            return (0, errors_1.sendError)(res, 503, "Withdrawals temporarily unavailable. Please try again later.");
        }
        // Generate idempotency key with random component to prevent collisions
        // Key is based on: user + destination + amount + timestamp + random nonce
        const timestamp = Date.now();
        const randomNonce = crypto_1.default.randomBytes(16).toString("hex");
        const idempotencyKey = crypto_1.default
            .createHash("sha256")
            .update(`${userId}-${destination_address}-${parsedAmount}-${timestamp}-${randomNonce}`)
            .digest("hex");
        // Step 1: Create withdrawal record and deduct balance (INSIDE transaction)
        // This prevents race conditions and ensures atomicity
        let withdrawal;
        try {
            const result = await (0, transaction_1.withTransaction)(async (client) => {
                // SECURITY FIX: Acquire user-level advisory lock to prevent concurrent withdrawals
                // This lock is automatically released when transaction commits/rolls back
                const lockId = hashUserId(userId);
                await client.query("SELECT pg_advisory_xact_lock($1)", [lockId]);
                // Get wallet with lock (prevents race conditions)
                const walletResult = await client.query(`SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`, [userId]);
                const wallet = walletResult.rows[0];
                if (!wallet) {
                    throw new transaction_1.TransactionError(404, "Wallet not found");
                }
                // Check USDC balance
                const currentBalance = Number(wallet.balance_usdc);
                if (currentBalance < parsedAmount) {
                    throw new transaction_1.TransactionError(400, "Insufficient balance", {
                        available: currentBalance,
                        requested: parsedAmount,
                    });
                }
                // SECURITY FIX: Check for ANY pending/processing withdrawal (stricter check)
                // Reduced window to 10 seconds for duplicate detection
                const tenSecondsAgo = Math.floor((Date.now() - 10000) / 1000);
                const duplicateCheck = await client.query(`SELECT id, status FROM withdrawals 
           WHERE user_id = $1 
             AND status IN ('pending', 'processing')
           LIMIT 1
           FOR UPDATE`, [userId]);
                if (duplicateCheck.rows.length > 0) {
                    const existing = duplicateCheck.rows[0];
                    throw new transaction_1.TransactionError(409, "You already have a pending withdrawal. Please wait for it to complete.", {
                        withdrawal_id: existing.id,
                        status: existing.status,
                    });
                }
                // SECURITY FIX: Check for duplicate within 10 seconds (reduced from 60)
                const recentDuplicateCheck = await client.query(`SELECT id, status FROM withdrawals 
           WHERE user_id = $1 
             AND destination_address = $2 
             AND amount = $3 
             AND created_at >= $4
           LIMIT 1
           FOR UPDATE`, [userId, destination_address, parsedAmount, tenSecondsAgo]);
                if (recentDuplicateCheck.rows.length > 0) {
                    const existing = recentDuplicateCheck.rows[0];
                    throw new transaction_1.TransactionError(409, "Duplicate withdrawal request detected. Please wait a moment before retrying.", {
                        withdrawal_id: existing.id,
                        status: existing.status,
                    });
                }
                // SECURITY FIX: Implement withdrawal cooldown period (30 seconds between withdrawals)
                const thirtySecondsAgo = Math.floor((Date.now() - 30000) / 1000);
                const recentWithdrawalCheck = await client.query(`SELECT id, created_at FROM withdrawals 
           WHERE user_id = $1 
             AND created_at >= $2
           ORDER BY created_at DESC
           LIMIT 1`, [userId, thirtySecondsAgo]);
                if (recentWithdrawalCheck.rows.length > 0) {
                    const lastWithdrawal = recentWithdrawalCheck.rows[0];
                    const timeSinceLastWithdrawal = Math.floor(Date.now() / 1000) - Number(lastWithdrawal.created_at);
                    const cooldownRemaining = 30 - timeSinceLastWithdrawal;
                    if (cooldownRemaining > 0) {
                        throw new transaction_1.TransactionError(429, `Withdrawal cooldown active. Please wait ${cooldownRemaining} seconds before requesting another withdrawal.`);
                    }
                }
                // Create withdrawal record using model (will be updated after Circle API call)
                // Handle potential idempotency key collision gracefully
                let withdrawalResult;
                try {
                    const withdrawal = await Withdrawal_1.WithdrawalModel.create({
                        user_id: userId,
                        wallet_id: wallet.id,
                        destination_address,
                        amount: parsedAmount,
                        token_symbol: "USDC",
                        status: "pending",
                        idempotency_key: idempotencyKey,
                    }, client);
                    withdrawalResult = { rows: [withdrawal] };
                }
                catch (insertError) {
                    // Handle unique constraint violation on idempotency_key
                    if (insertError.code === "23505" &&
                        insertError.constraint?.includes("idempotency_key")) {
                        // Idempotency key collision - check if it's a duplicate request
                        const existingWithdrawalQuery = await client.query(`SELECT * FROM withdrawals WHERE idempotency_key = $1`, [idempotencyKey]);
                        if (existingWithdrawalQuery.rows.length > 0) {
                            const existingWithdrawal = existingWithdrawalQuery.rows[0];
                            throw new transaction_1.TransactionError(409, "Duplicate withdrawal request detected", {
                                withdrawal_id: existingWithdrawal.id,
                                status: existingWithdrawal.status,
                                message: "This withdrawal request was already processed.",
                            });
                        }
                    }
                    throw insertError;
                }
                const newWithdrawal = withdrawalResult.rows[0];
                // Deduct from USDC balance immediately (inside transaction)
                await client.query(`UPDATE wallets SET balance_usdc = balance_usdc - $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`, [parsedAmount, wallet.id]);
                return {
                    withdrawal: newWithdrawal,
                    circleWalletId: wallet.circle_wallet_id,
                };
            });
            withdrawal = result.withdrawal;
        }
        catch (error) {
            if (error instanceof transaction_1.TransactionError) {
                return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
            }
            throw error;
        }
        // SECURITY FIX (CVE-004): Queue withdrawal for async processing
        // This prevents race conditions by processing Circle API calls in background
        // The balance is already deducted, so we're committed to processing this withdrawal
        try {
            const jobId = await (0, withdrawalQueue_1.queueWithdrawal)({
                withdrawalId: withdrawal.id,
                walletId: withdrawal.wallet_id,
                userId: userId,
                destinationAddress: destination_address,
                amount: parsedAmount,
                idempotencyKey: idempotencyKey,
            });
            // Update withdrawal with job_id for tracking
            await db_1.pool.query(`UPDATE withdrawals SET job_id = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`, [jobId, withdrawal.id]);
            // Return immediately - withdrawal will be processed asynchronously
            return (0, errors_1.sendSuccess)(res, {
                message: "Withdrawal request submitted successfully. Processing will begin shortly.",
                withdrawal: {
                    id: withdrawal.id,
                    amount: parsedAmount,
                    token_symbol: "USDC",
                    destination_address: destination_address,
                    status: "pending",
                    job_id: jobId,
                },
                note: "You will receive a notification when the withdrawal is completed. Check withdrawal status for updates.",
            });
        }
        catch (queueError) {
            console.error("Failed to queue withdrawal:", queueError);
            // If queueing fails, refund balance and mark as failed
            await (0, transaction_1.withTransaction)(async (client) => {
                const walletResult = await client.query(`SELECT id FROM wallets WHERE id = $1 FOR UPDATE`, [withdrawal.wallet_id]);
                const wallet = walletResult.rows[0];
                if (wallet) {
                    await client.query(`UPDATE wallets SET balance_usdc = balance_usdc + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`, [parsedAmount, wallet.id]);
                }
                await client.query(`UPDATE withdrawals 
           SET status = 'failed', failure_reason = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
           WHERE id = $2`, [queueError.message || "Failed to queue withdrawal", withdrawal.id]);
            });
            return (0, errors_1.sendError)(res, 500, "Failed to process withdrawal request", {
                withdrawal_id: withdrawal.id,
                error: queueError.message,
            });
        }
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Request withdrawal error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to process withdrawal request");
    }
};
exports.requestWithdrawal = requestWithdrawal;
/**
 * @route POST /api/withdrawal/:id/cancel
 * @desc Cancel a pending withdrawal (only if not yet processed)
 * @access Private
 */
const cancelWithdrawal = async (req, res) => {
    try {
        const userId = req.id;
        const { id } = req.params;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        await (0, transaction_1.withTransaction)(async (client) => {
            // Get withdrawal with lock
            const withdrawalResult = await client.query(`SELECT * FROM withdrawals WHERE id = $1 AND user_id = $2 FOR UPDATE`, [id, userId]);
            const withdrawal = withdrawalResult.rows[0];
            if (!withdrawal) {
                throw new transaction_1.TransactionError(404, "Withdrawal not found");
            }
            if (withdrawal.status !== "pending") {
                throw new transaction_1.TransactionError(400, "Can only cancel pending withdrawals", {
                    current_status: withdrawal.status,
                });
            }
            // Refund USDC to wallet
            await client.query(`UPDATE wallets SET balance_usdc = balance_usdc + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`, [withdrawal.amount, withdrawal.wallet_id]);
            // Update withdrawal status
            await client.query(`UPDATE withdrawals SET status = 'cancelled', updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $1`, [id]);
        });
        return (0, errors_1.sendSuccess)(res, {
            message: "Withdrawal cancelled successfully",
            refunded_amount: Number((await Withdrawal_1.WithdrawalModel.findById(id))?.amount || 0),
            token_symbol: "USDC",
        });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Cancel withdrawal error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to cancel withdrawal");
    }
};
exports.cancelWithdrawal = cancelWithdrawal;
/**
 * @route GET /api/withdrawal/history
 * @desc Get user's withdrawal history
 * @access Private
 */
const getWithdrawalHistory = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;
        const { withdrawals, total } = await Withdrawal_1.WithdrawalModel.findByUserId(userId, limit, offset);
        const totalPages = Math.ceil(total / limit);
        return (0, errors_1.sendSuccess)(res, {
            withdrawals,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            },
        });
    }
    catch (error) {
        console.error("Get withdrawal history error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to get withdrawal history");
    }
};
exports.getWithdrawalHistory = getWithdrawalHistory;
/**
 * @route GET /api/withdrawal/:id
 * @desc Get a specific withdrawal
 * @access Private
 */
const getWithdrawal = async (req, res) => {
    try {
        const userId = req.id;
        const { id } = req.params;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const withdrawal = await Withdrawal_1.WithdrawalModel.findById(id);
        if (!withdrawal || withdrawal.user_id !== userId) {
            return (0, errors_1.sendNotFound)(res, "Withdrawal");
        }
        return (0, errors_1.sendSuccess)(res, { withdrawal });
    }
    catch (error) {
        console.error("Get withdrawal error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to get withdrawal details");
    }
};
exports.getWithdrawal = getWithdrawal;
/**
 * @route GET /api/withdrawal/totals
 * @desc Get user's total withdrawals
 * @access Private
 */
const getWithdrawalTotals = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const totals = await Withdrawal_1.WithdrawalModel.getTotalWithdrawn(userId);
        return (0, errors_1.sendSuccess)(res, { totals });
    }
    catch (error) {
        console.error("Get withdrawal totals error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to get withdrawal totals");
    }
};
exports.getWithdrawalTotals = getWithdrawalTotals;
//# sourceMappingURL=controller_withdrawal.js.map