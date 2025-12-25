"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LpPositionModel = void 0;
const db_1 = require("../db");
class LpPositionModel {
    /**
     * Create or update an LP position (upsert)
     */
    static async create(data, client) {
        const { user_id, market_id, shares, deposited_amount, lp_token_balance = shares, } = data;
        const db = client || db_1.pool;
        const now = Math.floor(Date.now() / 1000);
        const query = `
      INSERT INTO lp_positions (user_id, market_id, shares, deposited_amount, lp_token_balance, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, market_id) 
      DO UPDATE SET 
        shares = lp_positions.shares + EXCLUDED.shares,
        deposited_amount = lp_positions.deposited_amount + EXCLUDED.deposited_amount,
        lp_token_balance = lp_positions.lp_token_balance + EXCLUDED.lp_token_balance,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      RETURNING *
    `;
        const result = await db.query(query, [
            user_id,
            market_id,
            shares,
            deposited_amount,
            lp_token_balance,
            now,
        ]);
        return result.rows[0];
    }
    /**
     * Find LP position by user and market
     */
    static async findByUserAndMarket(user_id, market_id, client) {
        const db = client || db_1.pool;
        const result = await db.query(`SELECT * FROM lp_positions WHERE user_id = $1 AND market_id = $2`, [user_id, market_id]);
        return result.rows[0] || null;
    }
    /**
     * Find all LP positions for a user
     */
    static async findByUser(user_id, client) {
        const db = client || db_1.pool;
        const result = await db.query(`SELECT * FROM lp_positions WHERE user_id = $1 AND shares > 0 ORDER BY created_at DESC`, [user_id]);
        return result.rows;
    }
    /**
     * Find all LP positions for a market
     */
    static async findByMarket(market_id, client) {
        const db = client || db_1.pool;
        const result = await db.query(`SELECT * FROM lp_positions WHERE market_id = $1 AND shares > 0 ORDER BY shares DESC`, [market_id]);
        return result.rows;
    }
    /**
     * Reduce shares from an LP position
     */
    static async reduceShares(user_id, market_id, sharesToRemove, client) {
        const db = client || db_1.pool;
        const query = `
      UPDATE lp_positions 
      SET shares = shares - $3, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE user_id = $1 AND market_id = $2 AND shares >= $3
      RETURNING *
    `;
        const result = await db.query(query, [user_id, market_id, sharesToRemove]);
        return result.rows[0] || null;
    }
    /**
     * Update deposited amount (for tracking purposes after withdrawal)
     */
    static async updateDepositedAmount(user_id, market_id, newDepositedAmount, client) {
        const db = client || db_1.pool;
        const query = `
      UPDATE lp_positions 
      SET deposited_amount = $3, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
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
    static async delete(user_id, market_id, client) {
        const db = client || db_1.pool;
        const result = await db.query(`DELETE FROM lp_positions WHERE user_id = $1 AND market_id = $2 RETURNING id`, [user_id, market_id]);
        return result.rows.length > 0;
    }
    /**
     * Get total LP positions count for a market
     */
    static async getMarketLpCount(market_id, client) {
        const db = client || db_1.pool;
        const result = await db.query(`SELECT COUNT(*)::int as count FROM lp_positions WHERE market_id = $1 AND shares > 0`, [market_id]);
        return result.rows[0]?.count || 0;
    }
}
exports.LpPositionModel = LpPositionModel;
//# sourceMappingURL=LpPosition.js.map