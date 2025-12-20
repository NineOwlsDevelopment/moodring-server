import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";

type QueryClient = Pool | PoolClient;

export interface LpPosition {
  id: UUID;
  user_id: UUID;
  market_id: UUID;
  shares: number;
  deposited_amount: number;
  lp_token_balance: number;
  created_at: Date;
  updated_at: Date;
}

export interface LpPositionCreateInput {
  user_id: UUID | string;
  market_id: UUID | string;
  shares: number;
  deposited_amount: number;
  lp_token_balance?: number;
}

export class LpPositionModel {
  /**
   * Create or update an LP position (upsert)
   */
  static async create(
    data: LpPositionCreateInput,
    client?: QueryClient
  ): Promise<LpPosition> {
    const { user_id, market_id, shares, deposited_amount, lp_token_balance = shares } = data;
    const db = client || pool;

    const query = `
      INSERT INTO lp_positions (user_id, market_id, shares, deposited_amount, lp_token_balance)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, market_id) 
      DO UPDATE SET 
        shares = lp_positions.shares + EXCLUDED.shares,
        deposited_amount = lp_positions.deposited_amount + EXCLUDED.deposited_amount,
        lp_token_balance = lp_positions.lp_token_balance + EXCLUDED.lp_token_balance,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await db.query(query, [
      user_id,
      market_id,
      shares,
      deposited_amount,
      lp_token_balance,
    ]);
    return result.rows[0];
  }

  /**
   * Find LP position by user and market
   */
  static async findByUserAndMarket(
    user_id: UUID | string,
    market_id: string,
    client?: QueryClient
  ): Promise<LpPosition | null> {
    const db = client || pool;
    const result = await db.query(
      `SELECT * FROM lp_positions WHERE user_id = $1 AND market_id = $2`,
      [user_id, market_id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all LP positions for a user
   */
  static async findByUser(
    user_id: UUID | string,
    client?: QueryClient
  ): Promise<LpPosition[]> {
    const db = client || pool;
    const result = await db.query(
      `SELECT * FROM lp_positions WHERE user_id = $1 AND shares > 0 ORDER BY created_at DESC`,
      [user_id]
    );
    return result.rows;
  }

  /**
   * Find all LP positions for a market
   */
  static async findByMarket(
    market_id: string,
    client?: QueryClient
  ): Promise<LpPosition[]> {
    const db = client || pool;
    const result = await db.query(
      `SELECT * FROM lp_positions WHERE market_id = $1 AND shares > 0 ORDER BY shares DESC`,
      [market_id]
    );
    return result.rows;
  }

  /**
   * Reduce shares from an LP position
   */
  static async reduceShares(
    user_id: UUID | string,
    market_id: string,
    sharesToRemove: number,
    client?: QueryClient
  ): Promise<LpPosition | null> {
    const db = client || pool;
    const query = `
      UPDATE lp_positions 
      SET shares = shares - $3, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND market_id = $2 AND shares >= $3
      RETURNING *
    `;
    const result = await db.query(query, [user_id, market_id, sharesToRemove]);
    return result.rows[0] || null;
  }

  /**
   * Update deposited amount (for tracking purposes after withdrawal)
   */
  static async updateDepositedAmount(
    user_id: UUID | string,
    market_id: string,
    newDepositedAmount: number,
    client?: QueryClient
  ): Promise<LpPosition | null> {
    const db = client || pool;
    const query = `
      UPDATE lp_positions 
      SET deposited_amount = $3, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND market_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [
      user_id,
      market_id,
      newDepositedAmount,
    ]);
    return result.rows[0] || null;
  }

  /**
   * Delete LP position (when shares reach 0)
   */
  static async delete(
    user_id: UUID | string,
    market_id: string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const result = await db.query(
      `DELETE FROM lp_positions WHERE user_id = $1 AND market_id = $2 RETURNING id`,
      [user_id, market_id]
    );
    return result.rows.length > 0;
  }

  /**
   * Get total LP positions count for a market
   */
  static async getMarketLpCount(
    market_id: string,
    client?: QueryClient
  ): Promise<number> {
    const db = client || pool;
    const result = await db.query(
      `SELECT COUNT(*)::int as count FROM lp_positions WHERE market_id = $1 AND shares > 0`,
      [market_id]
    );
    return result.rows[0]?.count || 0;
  }
}
