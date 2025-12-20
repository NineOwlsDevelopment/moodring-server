import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";

type QueryClient = Pool | PoolClient;

export interface PlatformStats {
  id: UUID;
  stat_date: Date;
  total_users: number;
  new_users: number;
  active_users: number;
  total_markets: number;
  new_markets: number;
  total_trades: number;
  total_volume: number;
  total_fees_collected: number;
  total_liquidity: number;
  created_at: number;
  updated_at: number;
}

export interface CreatorStats {
  id: UUID;
  user_id: UUID;
  markets_created: number;
  total_volume_generated: number;
  total_fees_earned: number;
  average_market_volume: number;
  markets_resolved: number;
  markets_disputed: number;
  reputation_score: number;
  created_at: number;
  updated_at: number;
}

export interface CreatorStatsWithUser extends CreatorStats {
  username: string;
  display_name: string | null;
}

export class PlatformStatsModel {
  /**
   * Get or create today's platform stats
   */
  static async getTodayStats(client?: QueryClient): Promise<PlatformStats> {
    const db = client || pool;
    const existing = await db.query(
      "SELECT * FROM platform_stats WHERE stat_date = EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()))::BIGINT"
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Calculate stats for today
    const [
      usersResult,
      newUsersResult,
      activeUsersResult,
      marketsResult,
      newMarketsResult,
      tradesResult,
    ] = await Promise.all([
      db.query("SELECT COUNT(*)::int as count FROM users"),
      db.query(
        "SELECT COUNT(*)::int as count FROM users WHERE created_at >= EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()))::BIGINT AND created_at < EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()) + INTERVAL '1 day')::BIGINT"
      ),
      db.query(
        "SELECT COUNT(DISTINCT user_id)::int as count FROM trades WHERE created_at >= EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()))::BIGINT AND created_at < EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()) + INTERVAL '1 day')::BIGINT"
      ),
      db.query("SELECT COUNT(*)::int as count FROM markets"),
      db.query(
        "SELECT COUNT(*)::int as count FROM markets WHERE created_at >= EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()))::BIGINT AND created_at < EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()) + INTERVAL '1 day')::BIGINT"
      ),
      db.query(
        `
        SELECT 
          COUNT(*)::int as count,
          COALESCE(SUM(total_cost), 0)::bigint as volume
        FROM trades 
        WHERE created_at >= EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()))::BIGINT AND created_at < EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()) + INTERVAL '1 day')::BIGINT
      `
      ),
    ]);

    const now = Math.floor(Date.now() / 1000);
    const result = await db.query(
      `
      INSERT INTO platform_stats (
        stat_date, total_users, new_users, active_users, 
        total_markets, new_markets, total_trades, total_volume, created_at
      ) VALUES (EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()))::BIGINT, $1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (stat_date) DO UPDATE SET
        total_users = $1,
        new_users = $2,
        active_users = $3,
        total_markets = $4,
        new_markets = $5,
        total_trades = $6,
        total_volume = $7,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      RETURNING *
    `,
      [
        usersResult.rows[0].count,
        newUsersResult.rows[0].count,
        activeUsersResult.rows[0].count,
        marketsResult.rows[0].count,
        newMarketsResult.rows[0].count,
        tradesResult.rows[0].count,
        tradesResult.rows[0].volume,
        now,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get historical stats for a date range
   */
  static async getHistoricalStats(
    days = 30,
    client?: QueryClient
  ): Promise<PlatformStats[]> {
    const db = client || pool;
    const result = await db.query(
      `
      SELECT * FROM platform_stats
      WHERE stat_date >= EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()) - INTERVAL '${days} days')::BIGINT
      ORDER BY stat_date DESC
    `
    );
    return result.rows;
  }

  /**
   * Get aggregate platform stats
   */
  static async getAggregateStats(client?: QueryClient): Promise<{
    total_users: number;
    total_markets: number;
    total_trades: number;
    total_volume: number;
    markets_active: number;
    markets_resolved: number;
  }> {
    const db = client || pool;
    const result = await db.query(`
      SELECT 
        (SELECT COUNT(*)::int FROM users) as total_users,
        (SELECT COUNT(*)::int FROM markets) as total_markets,
        (SELECT COUNT(*)::int FROM trades) as total_trades,
        (SELECT COALESCE(SUM(total_cost), 0)::bigint FROM trades WHERE status = 'completed') as total_volume,
        (SELECT COUNT(*)::int FROM markets WHERE is_resolved = FALSE AND is_initialized = TRUE) as markets_active,
        (SELECT COUNT(*)::int FROM markets WHERE is_resolved = TRUE) as markets_resolved
    `);
    return result.rows[0];
  }
}

export class CreatorStatsModel {
  /**
   * Get or create creator stats for a user
   */
  static async getOrCreate(
    userId: UUID | string,
    client?: QueryClient
  ): Promise<CreatorStats> {
    const db = client || pool;
    const existing = await db.query(
      "SELECT * FROM creator_stats WHERE user_id = $1",
      [userId]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    const now = Math.floor(Date.now() / 1000);
    const result = await db.query(
      "INSERT INTO creator_stats (user_id, created_at, updated_at) VALUES ($1, $2, $3) RETURNING *",
      [userId, now, now]
    );
    return result.rows[0];
  }

  static async findByUserId(
    userId: UUID | string,
    client?: QueryClient
  ): Promise<CreatorStats | null> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM creator_stats WHERE user_id = $1",
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update creator stats when a market is created
   */
  static async recordMarketCreated(
    userId: UUID | string,
    client?: QueryClient
  ): Promise<CreatorStats> {
    const db = client || pool;
    await this.getOrCreate(userId, client);

    const result = await db.query(
      `
      UPDATE creator_stats
      SET markets_created = markets_created + 1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE user_id = $1
      RETURNING *
    `,
      [userId]
    );
    return result.rows[0];
  }

  /**
   * Update creator stats when a market generates volume
   */
  static async recordVolume(
    userId: UUID | string,
    volume: number,
    fees: number,
    client?: QueryClient
  ): Promise<CreatorStats> {
    const db = client || pool;
    await this.getOrCreate(userId, client);

    const result = await db.query(
      `
      UPDATE creator_stats
      SET 
        total_volume_generated = total_volume_generated + $1,
        total_fees_earned = total_fees_earned + $2,
        average_market_volume = CASE 
          WHEN markets_created > 0 
          THEN (total_volume_generated + $1) / markets_created 
          ELSE 0 
        END,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE user_id = $3
      RETURNING *
    `,
      [volume, fees, userId]
    );
    return result.rows[0];
  }

  /**
   * Update creator stats when a market is resolved
   */
  static async recordResolution(
    userId: UUID | string,
    isDisputed: boolean = false,
    client?: QueryClient
  ): Promise<CreatorStats> {
    const db = client || pool;
    await this.getOrCreate(userId, client);

    const result = await db.query(
      `
      UPDATE creator_stats
      SET 
        markets_resolved = markets_resolved + 1,
        markets_disputed = markets_disputed + CASE WHEN $1 THEN 1 ELSE 0 END,
        reputation_score = CASE 
          WHEN $1 THEN GREATEST(reputation_score - 5, 0)
          ELSE LEAST(reputation_score + 1, 100)
        END,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE user_id = $2
      RETURNING *
    `,
      [isDisputed, userId]
    );
    return result.rows[0];
  }

  /**
   * Get top creators leaderboard
   */
  static async getTopCreators(
    limit = 50,
    client?: QueryClient
  ): Promise<CreatorStatsWithUser[]> {
    const db = client || pool;
    const result = await db.query(
      `
      SELECT cs.*, u.username, u.display_name
      FROM creator_stats cs
      LEFT JOIN users u ON cs.user_id = u.id
      WHERE cs.markets_created > 0
      ORDER BY cs.total_volume_generated DESC
      LIMIT $1
    `,
      [limit]
    );
    return result.rows;
  }
}
