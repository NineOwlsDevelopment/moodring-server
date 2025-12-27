"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserStatsModel = void 0;
const db_1 = require("../db");
class UserStatsModel {
    /**
     * Get or create stats for a user
     */
    static async getOrCreate(userId, client) {
        const db = client || db_1.pool;
        // Try to find existing stats
        const existing = await db.query("SELECT * FROM user_stats WHERE user_id = $1", [userId]);
        if (existing.rows.length > 0) {
            return existing.rows[0];
        }
        // Create new stats record
        const now = Math.floor(Date.now() / 1000);
        const result = await db.query("INSERT INTO user_stats (user_id, created_at, updated_at) VALUES ($1, $2, $3) RETURNING *", [userId, now, now]);
        return result.rows[0];
    }
    static async findByUserId(userId, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM user_stats WHERE user_id = $1", [userId]);
        return result.rows[0] || null;
    }
    /**
     * Increment specific stats
     */
    static async increment(userId, increments, client) {
        const db = client || db_1.pool;
        // Ensure stats record exists
        await this.getOrCreate(userId, client);
        const updates = [];
        const values = [];
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
        updates.push("updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT");
        values.push(userId);
        const result = await db.query(`
      UPDATE user_stats
      SET ${updates.join(", ")}
      WHERE user_id = $${paramCount}
      RETURNING *
    `, values);
        return result.rows[0];
    }
    /**
     * Record a trade and update relevant stats
     */
    static async recordTrade(userId, volume, fees, isNewMarket = false, client) {
        const db = client || db_1.pool;
        await this.getOrCreate(userId, client);
        const result = await db.query(`
      UPDATE user_stats
      SET 
        total_trades = total_trades + 1,
        total_volume = total_volume + $1,
        total_fees_paid = total_fees_paid + $2,
        markets_participated = markets_participated + CASE WHEN $3 THEN 1 ELSE 0 END,
        last_trade_at = EXTRACT(EPOCH FROM NOW())::BIGINT,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE user_id = $4
      RETURNING *
    `, [volume, fees, isNewMarket, userId]);
        return result.rows[0];
    }
    /**
     * Record a winning or losing trade
     */
    static async recordTradeResult(userId, profitLoss, isWin, client) {
        const db = client || db_1.pool;
        await this.getOrCreate(userId, client);
        const result = await db.query(`
      UPDATE user_stats
      SET 
        winning_trades = winning_trades + CASE WHEN $1 THEN 1 ELSE 0 END,
        losing_trades = losing_trades + CASE WHEN NOT $1 THEN 1 ELSE 0 END,
        total_profit_loss = total_profit_loss + $2,
        current_streak = CASE WHEN $1 THEN current_streak + 1 ELSE 0 END,
        longest_streak = GREATEST(longest_streak, CASE WHEN $1 THEN current_streak + 1 ELSE longest_streak END),
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE user_id = $3
      RETURNING *
    `, [isWin, profitLoss, userId]);
        return result.rows[0];
    }
    /**
     * Get leaderboard by volume
     */
    static async getLeaderboardByVolume(limit = 100, client) {
        const db = client || db_1.pool;
        const result = await db.query(`
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
    `, [limit]);
        return result.rows;
    }
    /**
     * Get leaderboard by profit/loss
     */
    static async getLeaderboardByProfit(limit = 100, client) {
        const db = client || db_1.pool;
        const result = await db.query(`
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
    `, [limit]);
        return result.rows;
    }
    /**
     * Get user's rank
     */
    static async getUserRank(userId, metric = "volume", client) {
        const db = client || db_1.pool;
        const orderBy = metric === "volume" ? "total_volume" : "total_profit_loss";
        const result = await db.query(`
      SELECT rank FROM (
        SELECT user_id, ROW_NUMBER() OVER (ORDER BY ${orderBy} DESC) as rank
        FROM user_stats
        WHERE total_trades > 0
      ) ranked
      WHERE user_id = $1
    `, [userId]);
        return result.rows[0]?.rank || 0;
    }
}
exports.UserStatsModel = UserStatsModel;
//# sourceMappingURL=UserStats.js.map