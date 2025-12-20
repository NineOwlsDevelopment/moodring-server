import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";

type QueryClient = Pool | PoolClient;

export interface UserStats {
  id: UUID;
  user_id: UUID;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_volume: number;
  total_profit_loss: number;
  total_fees_paid: number;
  markets_created: number;
  markets_participated: number;
  liquidity_provided: number;
  referrals_count: number;
  referral_earnings: number;
  current_streak: number;
  longest_streak: number;
  last_trade_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserStatsUpdate {
  total_trades?: number;
  winning_trades?: number;
  losing_trades?: number;
  total_volume?: number;
  total_profit_loss?: number;
  total_fees_paid?: number;
  markets_created?: number;
  markets_participated?: number;
  liquidity_provided?: number;
  referrals_count?: number;
  referral_earnings?: number;
  current_streak?: number;
  longest_streak?: number;
  last_trade_at?: Date;
}

export interface LeaderboardEntry {
  user_id: UUID;
  username: string;
  display_name: string | null;
  total_volume: number;
  total_profit_loss: number;
  total_trades: number;
  win_rate: number;
  rank: number;
}

export class UserStatsModel {
  /**
   * Get or create stats for a user
   */
  static async getOrCreate(
    userId: UUID | string,
    client?: QueryClient
  ): Promise<UserStats> {
    const db = client || pool;
    // Try to find existing stats
    const existing = await db.query(
      "SELECT * FROM user_stats WHERE user_id = $1",
      [userId]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Create new stats record
    const result = await db.query(
      "INSERT INTO user_stats (user_id) VALUES ($1) RETURNING *",
      [userId]
    );
    return result.rows[0];
  }

  static async findByUserId(
    userId: UUID | string,
    client?: QueryClient
  ): Promise<UserStats | null> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM user_stats WHERE user_id = $1",
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Increment specific stats
   */
  static async increment(
    userId: UUID | string,
    increments: Partial<Record<keyof UserStatsUpdate, number>>,
    client?: QueryClient
  ): Promise<UserStats> {
    const db = client || pool;
    // Ensure stats record exists
    await this.getOrCreate(userId, client);

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(increments).forEach(([key, value]) => {
      if (value !== undefined && typeof value === "number") {
        updates.push(`${key} = ${key} + $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      return this.getOrCreate(userId, client);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(userId);

    const result = await db.query(
      `
      UPDATE user_stats
      SET ${updates.join(", ")}
      WHERE user_id = $${paramCount}
      RETURNING *
    `,
      values
    );

    return result.rows[0];
  }

  /**
   * Record a trade and update relevant stats
   */
  static async recordTrade(
    userId: UUID | string,
    volume: number,
    fees: number,
    isNewMarket: boolean = false,
    client?: QueryClient
  ): Promise<UserStats> {
    const db = client || pool;
    await this.getOrCreate(userId, client);

    const result = await db.query(
      `
      UPDATE user_stats
      SET 
        total_trades = total_trades + 1,
        total_volume = total_volume + $1,
        total_fees_paid = total_fees_paid + $2,
        markets_participated = markets_participated + CASE WHEN $3 THEN 1 ELSE 0 END,
        last_trade_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $4
      RETURNING *
    `,
      [volume, fees, isNewMarket, userId]
    );

    return result.rows[0];
  }

  /**
   * Record a winning or losing trade
   */
  static async recordTradeResult(
    userId: UUID | string,
    profitLoss: number,
    isWin: boolean,
    client?: QueryClient
  ): Promise<UserStats> {
    const db = client || pool;
    await this.getOrCreate(userId, client);

    const result = await db.query(
      `
      UPDATE user_stats
      SET 
        winning_trades = winning_trades + CASE WHEN $1 THEN 1 ELSE 0 END,
        losing_trades = losing_trades + CASE WHEN NOT $1 THEN 1 ELSE 0 END,
        total_profit_loss = total_profit_loss + $2,
        current_streak = CASE WHEN $1 THEN current_streak + 1 ELSE 0 END,
        longest_streak = GREATEST(longest_streak, CASE WHEN $1 THEN current_streak + 1 ELSE longest_streak END),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $3
      RETURNING *
    `,
      [isWin, profitLoss, userId]
    );

    return result.rows[0];
  }

  /**
   * Get leaderboard by volume
   */
  static async getLeaderboardByVolume(
    limit = 100,
    client?: QueryClient
  ): Promise<LeaderboardEntry[]> {
    const db = client || pool;
    const result = await db.query(
      `
      SELECT 
        us.user_id,
        u.username,
        u.display_name,
        us.total_volume,
        us.total_profit_loss,
        us.total_trades,
        CASE WHEN us.total_trades > 0 
          THEN ROUND((us.winning_trades::decimal / us.total_trades) * 100, 2)
          ELSE 0 
        END as win_rate,
        ROW_NUMBER() OVER (ORDER BY us.total_volume DESC) as rank
      FROM user_stats us
      LEFT JOIN users u ON us.user_id = u.id
      WHERE us.total_trades > 0
      ORDER BY us.total_volume DESC
      LIMIT $1
    `,
      [limit]
    );
    return result.rows;
  }

  /**
   * Get leaderboard by profit/loss
   */
  static async getLeaderboardByProfit(
    limit = 100,
    client?: QueryClient
  ): Promise<LeaderboardEntry[]> {
    const db = client || pool;
    const result = await db.query(
      `
      SELECT 
        us.user_id,
        u.username,
        u.display_name,
        us.total_volume,
        us.total_profit_loss,
        us.total_trades,
        CASE WHEN us.total_trades > 0 
          THEN ROUND((us.winning_trades::decimal / us.total_trades) * 100, 2)
          ELSE 0 
        END as win_rate,
        ROW_NUMBER() OVER (ORDER BY us.total_profit_loss DESC) as rank
      FROM user_stats us
      LEFT JOIN users u ON us.user_id = u.id
      WHERE us.total_trades > 0
      ORDER BY us.total_profit_loss DESC
      LIMIT $1
    `,
      [limit]
    );
    return result.rows;
  }

  /**
   * Get user's rank
   */
  static async getUserRank(
    userId: UUID | string,
    metric: "volume" | "profit" = "volume",
    client?: QueryClient
  ): Promise<number> {
    const db = client || pool;
    const orderBy = metric === "volume" ? "total_volume" : "total_profit_loss";

    const result = await db.query(
      `
      SELECT rank FROM (
        SELECT user_id, ROW_NUMBER() OVER (ORDER BY ${orderBy} DESC) as rank
        FROM user_stats
        WHERE total_trades > 0
      ) ranked
      WHERE user_id = $1
    `,
      [userId]
    );

    return result.rows[0]?.rank || 0;
  }
}
