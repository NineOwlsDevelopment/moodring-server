import { Response } from "express";
import { PublicKey } from "@solana/web3.js";
import { UUID } from "crypto";
import crypto from "crypto";
import { WalletModel } from "../models/Wallet";
import { WithdrawalModel } from "../models/Withdrawal";
import { ActivityModel } from "../models/Activity";
import { NotificationModel } from "../models/Notification";
import { getCircleWallet } from "../services/circleWallet";
import { withTransaction, TransactionError } from "../utils/transaction";
import {
  sendError,
  sendNotFound,
  sendSuccess,
  sendValidationError,
} from "../utils/errors";
import { validateRequired, validateNumber } from "../utils/validation";
import { pool } from "../db";
import {
  RequestWithdrawalRequest,
  CancelWithdrawalRequest,
  GetWithdrawalHistoryRequest,
  GetWithdrawalRequest,
  GetWithdrawalTotalsRequest,
} from "../types/requests";

/**
 * @route POST /api/withdrawal/request
 * @desc Request a USDC withdrawal using Circle API (prevents double-spending with idempotency)
 * @access Private
 */
export const requestWithdrawal = async (
  req: RequestWithdrawalRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    const { destination_address, amount } = req.body;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    // Validate destination address
    try {
      new PublicKey(destination_address);
    } catch {
      return sendValidationError(res, "Invalid destination address");
    }

    // Validate amount
    const amountValidation = validateNumber(
      amount,
      "Amount",
      0.000001,
      undefined
    );
    if (!amountValidation.isValid) {
      return sendValidationError(res, amountValidation.error!);
    }

    const parsedAmount = Number(amount);

    const circleWallet = getCircleWallet();
    if (!circleWallet.isAvailable()) {
      return sendError(
        res,
        503,
        "Withdrawals temporarily unavailable. Please try again later."
      );
    }

    // Generate idempotency key with random component to prevent collisions
    // Key is based on: user + destination + amount + timestamp + random nonce
    const timestamp = Date.now();
    const randomNonce = crypto.randomBytes(16).toString("hex");
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(
        `${userId}-${destination_address}-${parsedAmount}-${timestamp}-${randomNonce}`
      )
      .digest("hex");

    // Step 1: Create withdrawal record and deduct balance (INSIDE transaction)
    // This prevents race conditions and ensures atomicity
    let withdrawal: any;
    let walletCircleId: string;
    try {
      const result = await withTransaction(async (client) => {
        // Get wallet with lock (prevents race conditions)
        const walletResult = await client.query(
          `SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`,
          [userId]
        );
        const wallet = walletResult.rows[0];

        if (!wallet) {
          throw new TransactionError(404, "Wallet not found");
        }

        // Check if wallet has Circle wallet ID
        if (!wallet.circle_wallet_id) {
          throw new TransactionError(
            400,
            "Wallet not configured for withdrawals. Please contact support."
          );
        }

        // Check USDC balance
        const currentBalance = Number(wallet.balance_usdc);

        if (currentBalance < parsedAmount) {
          throw new TransactionError(400, "Insufficient balance", {
            available: currentBalance,
            requested: parsedAmount,
          });
        }

        // Check for duplicate withdrawal requests (INSIDE transaction with lock)
        // This prevents race conditions - both checks happen atomically
        const fiveSecondsAgo = Math.floor((Date.now() - 5000) / 1000); // Unix timestamp in seconds
        const duplicateCheck = await client.query(
          `SELECT id, status FROM withdrawals 
           WHERE user_id = $1 
             AND destination_address = $2 
             AND amount = $3 
             AND status IN ('pending', 'processing')
             AND created_at >= $4
           LIMIT 1
           FOR UPDATE`,
          [userId, destination_address, parsedAmount, fiveSecondsAgo]
        );

        if (duplicateCheck.rows.length > 0) {
          const existing = duplicateCheck.rows[0];
          throw new TransactionError(
            409,
            "Duplicate withdrawal request detected",
            {
              withdrawal_id: existing.id,
              status: existing.status,
              message:
                "A withdrawal with the same parameters was recently requested. Please wait a moment.",
            }
          );
        }

        // Check for any pending/processing withdrawal (additional safety)
        const pendingCheck = await client.query(
          `SELECT id FROM withdrawals 
           WHERE user_id = $1 AND status IN ('pending', 'processing') 
           LIMIT 1
           FOR UPDATE`,
          [userId]
        );

        if (pendingCheck.rows.length > 0) {
          throw new TransactionError(
            400,
            "You already have a pending withdrawal. Please wait for it to complete."
          );
        }

        // Create withdrawal record using model (will be updated after Circle API call)
        // Handle potential idempotency key collision gracefully
        let withdrawalResult;
        try {
          const withdrawal = await WithdrawalModel.create(
            {
              user_id: userId as UUID,
              wallet_id: wallet.id as UUID,
              destination_address,
              amount: parsedAmount,
              token_symbol: "USDC" as const,
              status: "pending" as const,
              idempotency_key: idempotencyKey,
            },
            client
          );
          withdrawalResult = { rows: [withdrawal] };
        } catch (insertError: any) {
          // Handle unique constraint violation on idempotency_key
          if (
            insertError.code === "23505" &&
            insertError.constraint?.includes("idempotency_key")
          ) {
            // Idempotency key collision - check if it's a duplicate request
            const existingWithdrawalQuery = await client.query(
              `SELECT * FROM withdrawals WHERE idempotency_key = $1`,
              [idempotencyKey]
            );
            if (existingWithdrawalQuery.rows.length > 0) {
              const existingWithdrawal = existingWithdrawalQuery.rows[0];
              throw new TransactionError(
                409,
                "Duplicate withdrawal request detected",
                {
                  withdrawal_id: existingWithdrawal.id,
                  status: existingWithdrawal.status,
                  message: "This withdrawal request was already processed.",
                }
              );
            }
          }
          throw insertError;
        }

        const newWithdrawal = withdrawalResult.rows[0];

        // Deduct from USDC balance immediately (inside transaction)
        await client.query(
          `UPDATE wallets SET balance_usdc = balance_usdc - $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`,
          [parsedAmount, wallet.id]
        );

        return {
          withdrawal: newWithdrawal,
          circleWalletId: wallet.circle_wallet_id,
        };
      });

      withdrawal = result.withdrawal;
      walletCircleId = result.circleWalletId;
    } catch (error: any) {
      if (error instanceof TransactionError) {
        return sendError(res, error.statusCode, error.message, error.details);
      }
      throw error;
    }

    // Step 2: Execute Circle withdrawal OUTSIDE transaction
    // This prevents holding the database lock for up to 60 seconds
    // The balance is already deducted, so we're committed to processing this withdrawal
    let transactionId: string;
    try {
      // Update status to 'processing' before making API call
      await pool.query(
        `UPDATE withdrawals SET status = 'processing', updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $1`,
        [withdrawal.id]
      );

      // Execute Circle withdrawal (this can take up to 60 seconds)
      transactionId = await circleWallet.sendUsdc(
        walletCircleId,
        destination_address,
        parsedAmount
      );

      // Step 3: Update withdrawal as completed (INSIDE transaction for atomicity)
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE withdrawals 
           SET transaction_signature = $1, status = 'completed', updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
           WHERE id = $2`,
          [transactionId, withdrawal.id]
        );
      });

      withdrawal.transaction_signature = transactionId;
      withdrawal.status = "completed";
    } catch (circleError: any) {
      // Circle transaction failed - refund balance and mark as failed
      await withTransaction(async (client) => {
        // Get wallet with lock using wallet_id from withdrawal
        const walletResult = await client.query(
          `SELECT id FROM wallets WHERE id = $1 FOR UPDATE`,
          [withdrawal.wallet_id]
        );
        const wallet = walletResult.rows[0];

        if (wallet) {
          // Refund balance
          await client.query(
            `UPDATE wallets SET balance_usdc = balance_usdc + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`,
            [parsedAmount, wallet.id]
          );
        }

        // Mark withdrawal as failed
        await client.query(
          `UPDATE withdrawals 
           SET status = 'failed', failure_reason = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
           WHERE id = $2`,
          [circleError.message || "Circle API error", withdrawal.id]
        );
      });

      return sendError(res, 500, "Withdrawal transaction failed", {
        withdrawal_id: withdrawal.id,
        error: circleError.message,
      });
    }

    const result = { withdrawal, transactionId };

    // Record activity (outside transaction for performance)
    await ActivityModel.create({
      user_id: userId as UUID,
      activity_type: "liquidity_removed",
      entity_type: "user",
      entity_id: userId,
      metadata: {
        withdrawal_id: result.withdrawal.id,
        amount: parsedAmount,
        token_symbol: "USDC",
        destination: destination_address,
        transaction_signature: result.transactionId,
      },
      is_public: false,
    });

    // Send notification
    await NotificationModel.create({
      user_id: userId as UUID,
      notification_type: "withdrawal_completed",
      title: "Withdrawal Completed",
      message: `Your withdrawal of ${
        parsedAmount / 1_000_000
      } USDC has been completed.`,
      metadata: {
        withdrawal_id: result.withdrawal.id,
        amount: parsedAmount,
        token_symbol: "USDC",
        transaction_signature: result.transactionId,
      },
    });

    return sendSuccess(res, {
      message: "Withdrawal completed successfully",
      withdrawal: {
        id: result.withdrawal.id,
        amount: parsedAmount,
        token_symbol: "USDC",
        transaction_signature: result.transactionId,
        status: "completed",
      },
    });
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return sendError(res, error.statusCode, error.message, error.details);
    }
    console.error("Request withdrawal error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to process withdrawal request"
    );
  }
};

/**
 * @route POST /api/withdrawal/:id/cancel
 * @desc Cancel a pending withdrawal (only if not yet processed)
 * @access Private
 */
export const cancelWithdrawal = async (
  req: CancelWithdrawalRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    const { id } = req.params;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    await withTransaction(async (client) => {
      // Get withdrawal with lock
      const withdrawalResult = await client.query(
        `SELECT * FROM withdrawals WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, userId]
      );
      const withdrawal = withdrawalResult.rows[0];

      if (!withdrawal) {
        throw new TransactionError(404, "Withdrawal not found");
      }

      if (withdrawal.status !== "pending") {
        throw new TransactionError(400, "Can only cancel pending withdrawals", {
          current_status: withdrawal.status,
        });
      }

      // Refund USDC to wallet
      await client.query(
        `UPDATE wallets SET balance_usdc = balance_usdc + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`,
        [withdrawal.amount, withdrawal.wallet_id]
      );

      // Update withdrawal status
      await client.query(
        `UPDATE withdrawals SET status = 'cancelled', updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $1`,
        [id]
      );
    });

    return sendSuccess(res, {
      message: "Withdrawal cancelled successfully",
      refunded_amount: Number(
        (await WithdrawalModel.findById(id))?.amount || 0
      ),
      token_symbol: "USDC",
    });
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return sendError(res, error.statusCode, error.message, error.details);
    }
    console.error("Cancel withdrawal error:", error);
    return sendError(res, 500, error.message || "Failed to cancel withdrawal");
  }
};

/**
 * @route GET /api/withdrawal/history
 * @desc Get user's withdrawal history
 * @access Private
 */
export const getWithdrawalHistory = async (
  req: GetWithdrawalHistoryRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const { withdrawals, total } = await WithdrawalModel.findByUserId(
      userId,
      limit,
      offset
    );
    const totalPages = Math.ceil(total / limit);

    return sendSuccess(res, {
      withdrawals,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error: any) {
    console.error("Get withdrawal history error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to get withdrawal history"
    );
  }
};

/**
 * @route GET /api/withdrawal/:id
 * @desc Get a specific withdrawal
 * @access Private
 */
export const getWithdrawal = async (
  req: GetWithdrawalRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    const { id } = req.params;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    const withdrawal = await WithdrawalModel.findById(id);
    if (!withdrawal || withdrawal.user_id !== userId) {
      return sendNotFound(res, "Withdrawal");
    }

    return sendSuccess(res, { withdrawal });
  } catch (error: any) {
    console.error("Get withdrawal error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to get withdrawal details"
    );
  }
};

/**
 * @route GET /api/withdrawal/totals
 * @desc Get user's total withdrawals
 * @access Private
 */
export const getWithdrawalTotals = async (
  req: GetWithdrawalTotalsRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    const totals = await WithdrawalModel.getTotalWithdrawn(userId);

    return sendSuccess(res, { totals });
  } catch (error: any) {
    console.error("Get withdrawal totals error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to get withdrawal totals"
    );
  }
};
