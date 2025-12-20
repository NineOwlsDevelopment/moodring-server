import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";

type QueryClient = Pool | PoolClient;

export interface Trade {
  id: UUID;
  user_id: UUID;
  market_id: UUID;
  option_id: UUID;
  trade_type: "buy" | "sell";
  side: "yes" | "no";
  quantity: number;
  price_per_share: number;
  total_cost: number;
  fees_paid: number;
  transaction_signature: string | null;
  status: "pending" | "completed" | "failed";
  created_at: number;
  updated_at: number;
}

export interface TradeCreateInput {
  user_id: UUID;
  market_id: UUID;
  option_id: UUID;
  trade_type: "buy" | "sell";
  side: "yes" | "no";
  quantity: number;
  price_per_share: number;
  total_cost: number;
  fees_paid?: number;
  transaction_signature?: string;
  status?: "pending" | "completed" | "failed";
}

export interface TradeWithDetails extends Trade {
  market_question?: string;
  option_label?: string;
  username?: string;
}

export class TradeModel {
  static async create(
    data: TradeCreateInput,
    client?: QueryClient
  ): Promise<Trade> {
    const {
      user_id,
      market_id,
      option_id,
      trade_type,
      side,
      quantity,
      price_per_share,
      total_cost,
      fees_paid = 0,
      transaction_signature = null,
      status = "completed",
    } = data;
    const db = client || pool;
    const now = Math.floor(Date.now() / 1000);

    const query = `
      INSERT INTO trades (
        user_id, market_id, option_id,
        trade_type, side, quantity, price_per_share, total_cost,
        fees_paid, transaction_signature, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      user_id,
      market_id,
      option_id,
      trade_type,
      side,
      quantity,
      price_per_share,
      total_cost,
      fees_paid,
      transaction_signature,
      status,
      now,
      now,
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findById(
    id: UUID | string,
    client?: QueryClient
  ): Promise<Trade | null> {
    const db = client || pool;
    const result = await db.query("SELECT * FROM trades WHERE id = $1", [id]);
    return result.rows[0] || null;
  }

  static async findByUserId(
    userId: UUID | string,
    limit = 50,
    offset = 0,
    client?: QueryClient
  ): Promise<{ trades: TradeWithDetails[]; total: number }> {
    const db = client || pool;
    const [tradesResult, countResult] = await Promise.all([
      db.query(
        `
        SELECT t.*, m.question as market_question, o.option_label
        FROM trades t
        LEFT JOIN markets m ON t.market_id = m.id
        LEFT JOIN market_options o ON t.option_id = o.id
        WHERE t.user_id = $1
        ORDER BY t.created_at DESC
        LIMIT $2 OFFSET $3
      `,
        [userId, limit, offset]
      ),
      db.query("SELECT COUNT(*)::int as count FROM trades WHERE user_id = $1", [
        userId,
      ]),
    ]);

    return {
      trades: tradesResult.rows,
      total: countResult.rows[0]?.count || 0,
    };
  }

  static async findByMarket(
    marketId: string,
    limit = 50,
    offset = 0,
    client?: QueryClient
  ): Promise<{ trades: TradeWithDetails[]; total: number }> {
    const db = client || pool;
    const [tradesResult, countResult] = await Promise.all([
      db.query(
        `
        SELECT t.*, u.username, o.option_label
        FROM trades t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN market_options o ON t.option_id = o.id
        WHERE t.market_id = $1
        ORDER BY t.created_at DESC
        LIMIT $2 OFFSET $3
      `,
        [marketId, limit, offset]
      ),
      db.query(
        "SELECT COUNT(*)::int as count FROM trades WHERE market_id = $1",
        [marketId]
      ),
    ]);

    return {
      trades: tradesResult.rows,
      total: countResult.rows[0]?.count || 0,
    };
  }

  static async findByOption(
    optionId: string,
    limit = 50,
    offset = 0,
    client?: QueryClient
  ): Promise<{ trades: TradeWithDetails[]; total: number }> {
    const db = client || pool;
    const [tradesResult, countResult] = await Promise.all([
      db.query(
        `
        SELECT t.*, u.username, m.question as market_question
        FROM trades t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN markets m ON t.market_id = m.id
        WHERE t.option_id = $1
        ORDER BY t.created_at DESC
        LIMIT $2 OFFSET $3
      `,
        [optionId, limit, offset]
      ),
      db.query(
        "SELECT COUNT(*)::int as count FROM trades WHERE option_id = $1",
        [optionId]
      ),
    ]);

    return {
      trades: tradesResult.rows,
      total: countResult.rows[0]?.count || 0,
    };
  }

  static async getRecentTrades(
    limit = 20,
    client?: QueryClient
  ): Promise<TradeWithDetails[]> {
    const db = client || pool;
    const result = await db.query(
      `
      SELECT t.*, u.username, m.question as market_question, o.option_label
      FROM trades t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN markets m ON t.market_id = m.id
      LEFT JOIN market_options o ON t.option_id = o.id
      WHERE t.status = 'completed'
      ORDER BY t.created_at DESC
      LIMIT $1
    `,
      [limit]
    );
    return result.rows;
  }

  static async getUserTradeStats(
    userId: UUID | string,
    client?: QueryClient
  ): Promise<{
    total_trades: number;
    total_volume: number;
    buy_count: number;
    sell_count: number;
  }> {
    const db = client || pool;
    const result = await db.query(
      `
      SELECT 
        COUNT(*)::int as total_trades,
        COALESCE(SUM(total_cost), 0)::bigint as total_volume,
        COUNT(*) FILTER (WHERE trade_type = 'buy')::int as buy_count,
        COUNT(*) FILTER (WHERE trade_type = 'sell')::int as sell_count
      FROM trades
      WHERE user_id = $1 AND status = 'completed'
    `,
      [userId]
    );
    return result.rows[0];
  }

  static async updateStatus(
    id: UUID | string,
    status: "pending" | "completed" | "failed",
    transactionSignature?: string,
    client?: QueryClient
  ): Promise<Trade | null> {
    const db = client || pool;
    const result = await db.query(
      `
      UPDATE trades
      SET status = $1, transaction_signature = COALESCE($2, transaction_signature), updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $3
      RETURNING *
    `,
      [status, transactionSignature || null, id]
    );
    return result.rows[0] || null;
  }
}
