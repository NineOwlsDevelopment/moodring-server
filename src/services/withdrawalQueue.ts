import Queue, { Job } from "bull";
import { getCircleWallet } from "./circleWallet";
import { pool } from "../db";
import { withTransaction, TransactionError } from "../utils/transaction";
import { ActivityModel } from "../models/Activity";
import { NotificationModel } from "../models/Notification";
import { UUID } from "crypto";

/**
 * Withdrawal Job Queue
 * SECURITY FIX (CVE-004): Processes Circle API calls asynchronously to prevent race conditions
 *
 * This queue ensures:
 * 1. Circle API calls happen outside the main request/response cycle
 * 2. Idempotency is maintained via job IDs
 * 3. Failed withdrawals are automatically retried with exponential backoff
 * 4. Duplicate withdrawals are prevented at the job level
 */

// Initialize Bull queue with Redis connection
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const withdrawalQueue = new Queue("withdrawal-processing", redisUrl, {
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times
    backoff: {
      type: "exponential",
      delay: 5000, // Start with 5 second delay, exponential backoff
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days for debugging
    },
  },
});

/**
 * Job data interface for withdrawal processing
 */
export interface WithdrawalJobData {
  withdrawalId: string;
  walletId: string;
  userId: string;
  destinationAddress: string;
  amount: number; // in micro-USDC
  idempotencyKey: string;
}

/**
 * Process a withdrawal job
 * SECURITY FIX (CVE-004): This runs asynchronously, preventing race conditions
 */
withdrawalQueue.process(async (job: Job<WithdrawalJobData>) => {
  const {
    withdrawalId,
    walletId,
    userId,
    destinationAddress,
    amount,
    idempotencyKey,
  } = job.data as WithdrawalJobData;

  console.log(
    `[WithdrawalQueue] Processing withdrawal ${withdrawalId} for user ${userId}`
  );

  try {
    // Step 1: Verify withdrawal is still in 'pending' or 'processing' status
    // This prevents duplicate processing if job is retried
    const withdrawalCheck = await pool.query(
      `SELECT id, status, job_id FROM withdrawals WHERE id = $1 FOR UPDATE`,
      [withdrawalId]
    );

    if (withdrawalCheck.rows.length === 0) {
      throw new Error(`Withdrawal ${withdrawalId} not found`);
    }

    const withdrawal = withdrawalCheck.rows[0];

    // If already completed, skip (idempotency)
    if (withdrawal.status === "completed") {
      console.log(
        `[WithdrawalQueue] Withdrawal ${withdrawalId} already completed, skipping`
      );
      return {
        status: "already_completed",
        withdrawalId,
      };
    }

    // If already processing by another job, skip (prevent duplicate processing)
    if (
      withdrawal.status === "processing" &&
      withdrawal.job_id !== job.id.toString()
    ) {
      console.log(
        `[WithdrawalQueue] Withdrawal ${withdrawalId} already being processed by job ${withdrawal.job_id}, skipping`
      );
      throw new Error(
        `Withdrawal already being processed by another job: ${withdrawal.job_id}`
      );
    }

    // Update status to 'processing' and record job_id
    await pool.query(
      `UPDATE withdrawals 
       SET status = 'processing', job_id = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
       WHERE id = $2`,
      [job.id.toString(), withdrawalId]
    );

    // Step 2: Execute Circle withdrawal
    // This can take up to 60 seconds, but now it's in a background job
    const circleWallet = getCircleWallet();
    if (!circleWallet.isAvailable()) {
      throw new Error("Circle wallet service not available");
    }

    const transactionId = await circleWallet.sendUsdc(
      process.env.CIRCLE_HOT_WALLET_ID as string,
      destinationAddress,
      amount / 1_000_000 // Convert micro-USDC to USDC
    );

    if (!transactionId) {
      throw new Error("Circle API returned null transaction ID");
    }

    // Get the transaction hash from the transaction ID
    const transactionHash = await circleWallet.getTransactionHash(
      transactionId
    );

    // Step 3: Update withdrawal as completed (INSIDE transaction for atomicity)
    await withTransaction(async (client) => {
      // Double-check withdrawal status before updating (prevent race conditions)
      const finalCheck = await client.query(
        `SELECT status FROM withdrawals WHERE id = $1 FOR UPDATE`,
        [withdrawalId]
      );

      if (finalCheck.rows[0]?.status !== "processing") {
        throw new Error(
          `Withdrawal ${withdrawalId} status changed to ${finalCheck.rows[0]?.status}, cannot complete`
        );
      }

      await client.query(
        `UPDATE withdrawals 
         SET transaction_id = $1, transaction_signature = $2, status = 'completed', updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
         WHERE id = $3`,
        [transactionId, transactionHash, withdrawalId]
      );
    });

    // Step 4: Create activity and notification (non-blocking)
    try {
      await ActivityModel.create({
        user_id: userId as UUID,
        activity_type: "withdrawal",
        entity_type: "user",
        entity_id: userId,
        metadata: {
          withdrawal_id: withdrawalId,
          amount: amount,
          token_symbol: "USDC",
          destination: destinationAddress,
          transaction_id: transactionId,
          transaction_signature: transactionHash,
        },
        is_public: false,
      });

      await NotificationModel.create({
        user_id: userId as UUID,
        notification_type: "withdrawal_completed",
        title: "Withdrawal Completed",
        message: `Your withdrawal of ${
          amount / 1_000_000
        } USDC has been completed.`,
        metadata: {
          withdrawal_id: withdrawalId,
          amount: amount,
          token_symbol: "USDC",
          transaction_id: transactionId,
          transaction_signature: transactionHash,
        },
      });
    } catch (notifError) {
      // Don't fail the withdrawal if notification fails
      console.error(
        `[WithdrawalQueue] Failed to create activity/notification for withdrawal ${withdrawalId}:`,
        notifError
      );
    }

    console.log(
      `[WithdrawalQueue] ✅ Successfully processed withdrawal ${withdrawalId}, transaction: ${transactionId}`
    );

    return {
      status: "completed",
      withdrawalId,
      transactionId,
      transactionHash,
    };
  } catch (error: any) {
    console.error(
      `[WithdrawalQueue] ❌ Error processing withdrawal ${withdrawalId}:`,
      error
    );

    // Mark withdrawal as failed and refund balance
    await withTransaction(async (client) => {
      // Get wallet with lock
      const walletResult = await client.query(
        `SELECT id FROM wallets WHERE id = $1 FOR UPDATE`,
        [walletId]
      );
      const wallet = walletResult.rows[0];

      if (wallet) {
        // Refund balance
        await client.query(
          `UPDATE wallets SET balance_usdc = balance_usdc + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`,
          [amount, wallet.id]
        );
      }

      // Mark withdrawal as failed
      await client.query(
        `UPDATE withdrawals 
         SET status = 'failed', failure_reason = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
         WHERE id = $2`,
        [
          error.message || "Unknown error during withdrawal processing",
          withdrawalId,
        ]
      );
    });

    // Re-throw error so Bull can retry if attempts remain
    throw error;
  }
});

/**
 * Add a withdrawal to the queue
 * SECURITY FIX (CVE-004): Returns immediately, processing happens asynchronously
 */
export async function queueWithdrawal(
  data: WithdrawalJobData
): Promise<string> {
  // Use idempotency key as job ID to prevent duplicate jobs
  const job = await withdrawalQueue.add("process-withdrawal", data, {
    jobId: data.idempotencyKey, // Use idempotency key as job ID
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  });

  console.log(
    `[WithdrawalQueue] Queued withdrawal ${data.withdrawalId} as job ${job.id}`
  );

  return job.id.toString();
}

/**
 * Get withdrawal job status
 */
export async function getWithdrawalJobStatus(jobId: string): Promise<{
  status: string;
  progress?: number;
  result?: any;
  error?: string;
}> {
  const job = await withdrawalQueue.getJob(jobId);

  if (!job) {
    return { status: "not_found" };
  }

  const state = await job.getState();
  const progress = job.progress();
  const result = job.returnvalue;
  const failedReason = job.failedReason;

  return {
    status: state,
    progress,
    result,
    error: failedReason,
  };
}

/**
 * Initialize withdrawal queue (call this on server startup)
 */
export function initializeWithdrawalQueue(): void {
  console.log("[WithdrawalQueue] Initializing withdrawal job queue...");

  // Handle completed jobs
  withdrawalQueue.on(
    "completed",
    (job: Job<WithdrawalJobData>, result: any) => {
      console.log(`[WithdrawalQueue] Job ${job.id} completed:`, result);
    }
  );

  // Handle failed jobs
  withdrawalQueue.on("failed", (job: Job<WithdrawalJobData>, error: Error) => {
    console.error(
      `[WithdrawalQueue] Job ${job.id} failed after ${job.attemptsMade} attempts:`,
      error.message
    );
  });

  // Handle stalled jobs (jobs that take too long)
  withdrawalQueue.on("stalled", (job: Job<WithdrawalJobData>) => {
    console.warn(`[WithdrawalQueue] Job ${job.id} stalled, will be retried`);
  });

  console.log("[WithdrawalQueue] ✅ Withdrawal queue initialized");
}
