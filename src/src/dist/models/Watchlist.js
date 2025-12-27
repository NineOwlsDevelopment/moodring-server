"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WatchlistModel = void 0;
const db_1 = require("../db");
class WatchlistModel {
    /**
     * Add a market to user's watchlist
     */
    static async add(data, client) {
        const { user_id, market_id } = data;
        const db = client || db_1.pool;
        const now = Math.floor(Date.now() / 1000);
        const query = `
      INSERT INTO watchlist (user_id, market_id, created_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, market_id) DO NOTHING
      RETURNING *
    `;
        const result = await db.query(query, [user_id, market_id, now]);
        if (result.rows[0]) {
            return result.rows[0];
        }
        // If no row returned (conflict), fetch existing
        const existing = await db.query("SELECT * FROM watchlist WHERE user_id = $1 AND market_id = $2", [user_id, market_id]);
        return existing.rows[0];
    }
    /**
     * Remove a market from user's watchlist
     */
    static async remove(user_id, market_id, client) {
        const db = client || db_1.pool;
        const result = await db.query("DELETE FROM watchlist WHERE user_id = $1 AND market_id = $2 RETURNING id", [user_id, market_id]);
        return result.rows.length > 0;
    }
    /**
     * Check if a market is in user's watchlist
     */
    static async isWatched(user_id, market_id, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT 1 FROM watchlist WHERE user_id = $1 AND market_id = $2 LIMIT 1", [user_id, market_id]);
        return result.rows.length > 0;
    }
    /**
     * Get all market IDs in user's watchlist
     */
    static async getMarketIds(user_id, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT market_id FROM watchlist WHERE user_id = $1 ORDER BY created_at DESC", [user_id]);
        return result.rows.map((row) => row.market_id);
    }
    /**
     * Get all watchlist entries for a user
     */
    static async findByUserId(user_id, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM watchlist WHERE user_id = $1 ORDER BY created_at DESC", [user_id]);
        return result.rows;
    }
    /**
     * Get watchlist status for multiple markets (returns set of market IDs)
     */
    static async getWatchedMarketIds(user_id, market_ids, client) {
        if (market_ids.length === 0) {
            return new Set();
        }
        const db = client || db_1.pool;
        const result = await db.query("SELECT market_id FROM watchlist WHERE user_id = $1 AND market_id = ANY($2::uuid[])", [user_id, market_ids]);
        return new Set(result.rows.map((row) => row.market_id));
    }
}
exports.WatchlistModel = WatchlistModel;
//# sourceMappingURL=Watchlist.js.map