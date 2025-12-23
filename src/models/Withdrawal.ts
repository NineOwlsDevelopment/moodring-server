import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";

type QueryClient = Pool | PoolClient;

export interface Withdrawal {
  id: UUID;
  user_id: UUID;
  wallet_id: UUID;
  destination_address: string;
  amount: number;
  token_symbol: "SOL" | "USDC";
  transaction_id: string | null;
  transaction_signature: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  failure_reason: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number;
}

export interface WithdrawalCreateInput {
  user_id: UUID;
  wallet_id: UUID;
  destination_address: string;
  amount: number;
  token_symbol: "SOL" | "USDC";
  status?: "pending" | "processing" | "completed" | "failed";
  idempotency_key?: string;
}

export class WithdrawalModel {
  static async create(
    data: WithdrawalCreateInput,
    client?: QueryClient
  ): Promise<Withdrawal> {
    const {
      user_id,
      wallet_id,
      destination_address,
      amount,
      token_symbol,
      status = "pending",
      idempotency_key = null,
    } = data;
    const db = client || pool;
    const now = Math.floor(Date.now() / 1000);

    const query = `
      INSERT INTO withdrawals (user_id, wallet_id, destination_address, amount, token_symbol, status, idempotency_key, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await db.query(query, [
      user_id,
      wallet_id,
      destination_address,
      amount,
      token_symbol,
      status,
      idempotency_key,
      now,
      now,
    ]);
    return result.rows[0];
  }

  static async findById(
    id: UUID | string,
    client?: QueryClient
  ): Promise<Withdrawal | null> {
    const db = client || pool;
    const result = await db.query("SELECT * FROM withdrawals WHERE id = $1", [
      id,
    ]);
    return result.rows[0] || null;
  }

  static async findByUserId(
    userId: UUID | string,
    limit = 50,
    offset = 0,
    client?: QueryClient
  ): Promise<{ withdrawals: Withdrawal[]; total: number }> {
    const db = client || pool;
    const [withdrawalsResult, countResult] = await Promise.all([
      db.query(
        `
        SELECT * FROM withdrawals
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
        [userId, limit, offset]
      ),
      db.query(
        "SELECT COUNT(*)::int as count FROM withdrawals WHERE user_id = $1",
        [userId]
      ),
    ]);

    return {
      withdrawals: withdrawalsResult.rows,
      total: countResult.rows[0]?.count || 0,
    };
  }

  static async findPending(client?: QueryClient): Promise<Withdrawal[]> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM withdrawals WHERE status = 'pending' ORDER BY created_at ASC"
    );
    return result.rows;
  }

  static async updateStatus(
    id: UUID | string,
    status: "pending" | "processing" | "completed" | "failed",
    transactionSignature?: string,
    transactionId?: string,
    failureReason?: string,
    client?: QueryClient
  ): Promise<Withdrawal | null> {
    const db = client || pool;
    const completedAt =
      status === "completed" ? "EXTRACT(EPOCH FROM NOW())::BIGINT" : "NULL";

    const result = await db.query(
      `
      UPDATE withdrawals
      SET 
        status = $1, 
        transaction_id = COALESCE($2, transaction_id),
        transaction_signature = COALESCE($3, transaction_signature),
        failure_reason = COALESCE($4, failure_reason),
        completed_at = ${
          status === "completed"
            ? "EXTRACT(EPOCH FROM NOW())::BIGINT"
            : "completed_at"
        },
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $5
      RETURNING *
    `,
      [
        status,
        transactionId || null,
        transactionSignature || null,
        failureReason || null,
        id,
      ]
    );
    return result.rows[0] || null;
  }

  static async hasPendingWithdrawal(
    userId: UUID | string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const result = await db.query(
      "SELECT 1 FROM withdrawals WHERE user_id = $1 AND status IN ('pending', 'processing') LIMIT 1",
      [userId]
    );
    return result.rows.length > 0;
  }

  static async getTotalWithdrawn(
    userId: UUID | string,
    client?: QueryClient
  ): Promise<{ sol: number; usdc: number }> {
    const db = client || pool;
    const result = await db.query(
      `
      SELECT 
        COALESCE(SUM(amount) FILTER (WHERE token_symbol = 'SOL'), 0)::bigint as sol,
        COALESCE(SUM(amount) FILTER (WHERE token_symbol = 'USDC'), 0)::bigint as usdc
      FROM withdrawals
      WHERE user_id = $1 AND status = 'completed'
    `,
      [userId]
    );
    return result.rows[0];
  }
}
