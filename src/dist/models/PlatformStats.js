"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatorStatsModel = exports.PlatformStatsModel = void 0;
const db_1 = require("../db");
class PlatformStatsModel {
    /**
     * Get or create today's platform stats
     */
    static async getTodayStats(client) {
        const db = client || db_1.pool;
        const existing = await db.query("SELECT * FROM platform_stats WHERE stat_date = EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()))::BIGINT");
        if (existing.rows.length > 0) {
            return existing.rows[0];
        }
        // Calculate stats for today
        const [usersResult, newUsersResult, activeUsersResult, marketsResult, newMarketsResult, tradesResult,] = await Promise.all([
            db.query("SELECT COUNT(*)::int as count FROM users"),
            db.query("SELECT COUNT(*)::int as count FROM users WHERE created_at >= EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()))::BIGINT AND created_at < EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()) + INTERVAL '1 day')::BIGINT"),
            db.query("SELECT COUNT(DISTINCT user_id)::int as count FROM trades WHERE created_at >= EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()))::BIGINT AND created_at < EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()) + INTERVAL '1 day')::BIGINT"),
            db.query("SELECT COUNT(*)::int as count FROM markets"),
            db.query("SELECT COUNT(*)::int as count FROM markets WHERE created_at >= EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()))::BIGINT AND created_at < EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()) + INTERVAL '1 day')::BIGINT"),
            db.query(`
        SELECT 
          COUNT(*)::int as count,
          COALESCE(SUM(total_cost), 0)::bigint as volume
        FROM trades 
        WHERE created_at >= EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()))::BIGINT AND created_at < EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()) + INTERVAL '1 day')::BIGINT
      `),
        ]);
        const now = Math.floor(Date.now() / 1000);
        const result = await db.query(`
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
    `, [
            usersResult.rows[0].count,
            newUsersResult.rows[0].count,
            activeUsersResult.rows[0].count,
            marketsResult.rows[0].count,
            newMarketsResult.rows[0].count,
            tradesResult.rows[0].count,
            tradesResult.rows[0].volume,
            now,
        ]);
        return result.rows[0];
    }
    /**
     * Get historical stats for a date range
     */
    static async getHistoricalStats(days = 30, client) {
        const db = client || db_1.pool;
        const result = await db.query(`
      SELECT * FROM platform_stats
      WHERE stat_date >= EXTRACT(EPOCH FROM DATE_TRUNC('day', NOW()) - INTERVAL '${days} days')::BIGINT
      ORDER BY stat_date DESC
    `);
        return result.rows;
    }
    /**
     * Get aggregate platform stats
     */
    static async getAggregateStats(client) {
        const db = client || db_1.pool;
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
exports.PlatformStatsModel = PlatformStatsModel;
class CreatorStatsModel {
    /**
     * Get or create creator stats for a user
     */
    static async getOrCreate(userId, client) {
        const db = client || db_1.pool;
        const existing = await db.query("SELECT * FROM creator_stats WHERE user_id = $1", [userId]);
        if (existing.rows.length > 0) {
            return existing.rows[0];
        }
        const now = Math.floor(Date.now() / 1000);
        const result = await db.query("INSERT INTO creator_stats (user_id, created_at, updated_at) VALUES ($1, $2, $3) RETURNING *", [userId, now, now]);
        return result.rows[0];
    }
    static async findByUserId(userId, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM creator_stats WHERE user_id = $1", [userId]);
        return result.rows[0] || null;
    }
    /**
     * Update creator stats when a market is created
     */
    static async recordMarketCreated(userId, client) {
        const db = client || db_1.pool;
        await this.getOrCreate(userId, client);
        const result = await db.query(`
      UPDATE creator_stats
      SET markets_created = markets_created + 1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE user_id = $1
      RETURNING *
    `, [userId]);
        return result.rows[0];
    }
    /**
     * Update creator stats when a market generates volume
     */
    static async recordVolume(userId, volume, fees, client) {
        const db = client || db_1.pool;
        await this.getOrCreate(userId, client);
        const result = await db.query(`
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
    `, [volume, fees, userId]);
        return result.rows[0];
    }
    /**
     * Update creator stats when a market is resolved
     */
    static async recordResolution(userId, isDisputed = false, client) {
        const db = client || db_1.pool;
        await this.getOrCreate(userId, client);
        const result = await db.query(`
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
    `, [isDisputed, userId]);
        return result.rows[0];
    }
    /**
     * Get top creators leaderboard
     */
    static async getTopCreators(limit = 50, client) {
        const db = client || db_1.pool;
        const result = await db.query(`
      SELECT cs.*, u.username, u.display_name
      FROM creator_stats cs
      LEFT JOIN users u ON cs.user_id = u.id
      WHERE cs.markets_created > 0
      ORDER BY cs.total_volume_generated DESC
      LIMIT $1
    `, [limit]);
        return result.rows;
    }
}
exports.CreatorStatsModel = CreatorStatsModel;
//# sourceMappingURL=PlatformStats.js.map