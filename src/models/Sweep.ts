import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";

type QueryClient = Pool | PoolClient;

export interface WalletSweep {
  id: UUID;
  wallet_id: UUID;
  user_id: UUID;
  deposit_id: UUID | null;
  source_address: string;
  destination_address: string;
  amount: number;
  token_symbol: string;
  transaction_signature: string | null;
  status: "pending" | "completed" | "failed";
  failure_reason: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number;
}

export interface SweepCreateInput {
  wallet_id: UUID | string;
  user_id: UUID | string;
  deposit_id?: UUID | string | null;
  source_address: string;
  destination_address: string;
  amount: number;
  token_symbol?: string;
}

export class SweepModel {
  /**
   * Create a new sweep record in pending status
   */
  static async create(
    data: SweepCreateInput,
    client?: QueryClient
  ): Promise<WalletSweep> {
    const {
      wallet_id,
      user_id,
      deposit_id = null,
      source_address,
      destination_address,
      amount,
      token_symbol = "USDC",
    } = data;
    const db = client || pool;
    const now = Math.floor(Date.now() / 1000);

    const result = await db.query(
      `INSERT INTO wallet_sweeps (
        wallet_id,
        user_id,
        deposit_id,
        source_address,
        destination_address,
        amount,
        token_symbol,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)
      RETURNING *`,
      [
        wallet_id,
        user_id,
        deposit_id,
        source_address,
        destination_address,
        amount,
        token_symbol,
        now,
        now,
      ]
    );

    return result.rows[0];
  }

  /**
   * Mark a sweep as completed with transaction signature
   */
  static async markCompleted(
    sweepId: UUID | string,
    transactionSignature: string,
    client?: QueryClient
  ): Promise<WalletSweep | null> {
    const db = client || pool;

    const result = await db.query(
      `UPDATE wallet_sweeps
       SET status = 'completed',
           transaction_signature = $2,
           completed_at = EXTRACT(EPOCH FROM NOW())::BIGINT,
           updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
       WHERE id = $1
       RETURNING *`,
      [sweepId, transactionSignature]
    );

    return result.rows[0] || null;
  }

  /**
   * Mark a sweep as failed with reason
   */
  static async markFailed(
    sweepId: UUID | string,
    failureReason: string,
    client?: QueryClient
  ): Promise<WalletSweep | null> {
    const db = client || pool;

    const result = await db.query(
      `UPDATE wallet_sweeps
       SET status = 'failed',
           failure_reason = $2,
           updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
       WHERE id = $1
       RETURNING *`,
      [sweepId, failureReason]
    );

    return result.rows[0] || null;
  }

  /**
   * Find sweep by ID
   */
  static async findById(
    id: UUID | string,
    client?: QueryClient
  ): Promise<WalletSweep | null> {
    const db = client || pool;
    const result = await db.query("SELECT * FROM wallet_sweeps WHERE id = $1", [
      id,
    ]);

    return result.rows[0] || null;
  }

  /**
   * Find all pending sweeps (for retry logic)
   */
  static async findPending(client?: QueryClient): Promise<WalletSweep[]> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM wallet_sweeps WHERE status = 'pending' ORDER BY created_at ASC"
    );

    return result.rows;
  }

  /**
   * Find all failed sweeps (for retry logic)
   */
  static async findFailed(client?: QueryClient): Promise<WalletSweep[]> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM wallet_sweeps WHERE status = 'failed' ORDER BY created_at ASC"
    );

    return result.rows;
  }

  /**
   * Find sweeps by wallet ID
   */
  static async findByWalletId(
    walletId: UUID | string,
    client?: QueryClient
  ): Promise<WalletSweep[]> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM wallet_sweeps WHERE wallet_id = $1 ORDER BY created_at DESC",
      [walletId]
    );

    return result.rows;
  }

  /**
   * Find sweeps by user ID
   */
  static async findByUserId(
    userId: UUID | string,
    client?: QueryClient
  ): Promise<WalletSweep[]> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM wallet_sweeps WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );

    return result.rows;
  }

  /**
   * Get sweep statistics
   */
  static async getStats(client?: QueryClient): Promise<{
    total: number;
    pending: number;
    completed: number;
    failed: number;
    total_amount_swept: number;
  }> {
    const db = client || pool;
    const result = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as total_amount_swept
      FROM wallet_sweeps
    `);

    const row = result.rows[0];
    return {
      total: parseInt(row.total, 10),
      pending: parseInt(row.pending, 10),
      completed: parseInt(row.completed, 10),
      failed: parseInt(row.failed, 10),
      total_amount_swept: parseInt(row.total_amount_swept, 10),
    };
  }
}
