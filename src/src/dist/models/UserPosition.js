"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPositionModel = void 0;
const db_1 = require("../db");
class UserPositionModel {
    /**
     * Get or create a user position for an option
     */
    static async getOrCreate(data, client) {
        const { user_id, market_id, option_id } = data;
        const db = client || db_1.pool;
        const now = Math.floor(Date.now() / 1000);
        const query = `
      INSERT INTO user_positions (user_id, market_id, option_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, option_id) DO NOTHING
      RETURNING *
    `;
        const result = await db.query(query, [
            user_id,
            market_id,
            option_id,
            now,
            now,
        ]);
        if (result.rows[0]) {
            return result.rows[0];
        }
        // If no insert happened (conflict), fetch existing
        return this.findByUserAndOption(user_id, option_id, client);
    }
    /**
     * Find position by user and option
     */
    static async findByUserAndOption(user_id, option_id, client) {
        const db = client || db_1.pool;
        const result = await db.query(`SELECT * FROM user_positions WHERE user_id = $1 AND option_id = $2`, [user_id, option_id]);
        return result.rows[0] || null;
    }
    /**
     * Find all positions for a user
     */
    static async findByUser(user_id, client) {
        const db = client || db_1.pool;
        const result = await db.query(`SELECT * FROM user_positions 
       WHERE user_id = $1 AND (yes_shares > 0 OR no_shares > 0) 
       ORDER BY updated_at DESC`, [user_id]);
        return result.rows;
    }
    /**
     * Find all positions for a user in a specific market
     */
    static async findByUserAndMarket(user_id, market_id, client) {
        const db = client || db_1.pool;
        const result = await db.query(`SELECT * FROM user_positions 
       WHERE user_id = $1 AND market_id = $2 
       ORDER BY created_at ASC`, [user_id, market_id]);
        return result.rows;
    }
    /**
     * Add shares to a position (buying)
     */
    static async addShares(user_id, option_id, yesShares, noShares, cost, client) {
        const db = client || db_1.pool;
        // First ensure position exists
        const existing = await this.findByUserAndOption(user_id, option_id, client);
        if (!existing) {
            return null;
        }
        // Calculate new average prices
        const newYesShares = existing.yes_shares + yesShares;
        const newNoShares = existing.no_shares + noShares;
        // Allocate cost proportionally if buying both using BigInt for precision
        const totalNewShares = yesShares + noShares;
        const yesCost = totalNewShares > 0
            ? Number((BigInt(yesShares) * BigInt(cost)) / BigInt(totalNewShares))
            : 0;
        const noCost = totalNewShares > 0
            ? Number((BigInt(noShares) * BigInt(cost)) / BigInt(totalNewShares))
            : 0;
        const newTotalYesCost = existing.total_yes_cost + yesCost;
        const newTotalNoCost = existing.total_no_cost + noCost;
        // Use BigInt for precision: total_cost / shares (integer division)
        const newAvgYesPrice = newYesShares > 0
            ? Number(BigInt(newTotalYesCost) / BigInt(newYesShares))
            : 0;
        const newAvgNoPrice = newNoShares > 0
            ? Number(BigInt(newTotalNoCost) / BigInt(newNoShares))
            : 0;
        const query = `
      UPDATE user_positions 
      SET 
        yes_shares = $3,
        no_shares = $4,
        avg_yes_price = $5,
        avg_no_price = $6,
        total_yes_cost = $7,
        total_no_cost = $8,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE user_id = $1 AND option_id = $2
      RETURNING *
    `;
        const result = await db.query(query, [
            user_id,
            option_id,
            newYesShares,
            newNoShares,
            newAvgYesPrice,
            newAvgNoPrice,
            newTotalYesCost,
            newTotalNoCost,
        ]);
        return result.rows[0] || null;
    }
    /**
     * Remove shares from a position (selling)
     */
    static async removeShares(user_id, option_id, yesShares, noShares, payout, client) {
        const db = client || db_1.pool;
        const existing = await this.findByUserAndOption(user_id, option_id, client);
        if (!existing) {
            return null;
        }
        if (existing.yes_shares < yesShares || existing.no_shares < noShares) {
            throw new Error("Insufficient shares to sell");
        }
        const newYesShares = existing.yes_shares - yesShares;
        const newNoShares = existing.no_shares - noShares;
        // Calculate realized PnL using BigInt for precision
        const yesCostBasis = Number(BigInt(yesShares) * BigInt(Math.round(existing.avg_yes_price)));
        const noCostBasis = Number(BigInt(noShares) * BigInt(Math.round(existing.avg_no_price)));
        const totalCostBasis = yesCostBasis + noCostBasis;
        const pnl = payout - totalCostBasis;
        // Update total cost proportionally using BigInt for precision
        const newTotalYesCost = Number(BigInt(newYesShares) * BigInt(Math.round(existing.avg_yes_price)));
        const newTotalNoCost = Number(BigInt(newNoShares) * BigInt(Math.round(existing.avg_no_price)));
        const query = `
      UPDATE user_positions 
      SET 
        yes_shares = $3,
        no_shares = $4,
        total_yes_cost = $5,
        total_no_cost = $6,
        realized_pnl = realized_pnl + $7,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE user_id = $1 AND option_id = $2
      RETURNING *
    `;
        const result = await db.query(query, [
            user_id,
            option_id,
            newYesShares,
            newNoShares,
            newTotalYesCost,
            newTotalNoCost,
            pnl,
        ]);
        return result.rows[0] || null;
    }
    /**
     * Claim winnings - zero out position and record PnL
     */
    static async claimWinnings(user_id, option_id, winningSide, payoutPerShare, client) {
        const db = client || db_1.pool;
        const existing = await this.findByUserAndOption(user_id, option_id, client);
        if (!existing) {
            return null;
        }
        const winningShares = winningSide === "yes" ? existing.yes_shares : existing.no_shares;
        const losingShares = winningSide === "yes" ? existing.no_shares : existing.yes_shares;
        // Use BigInt for precision: shares * payout_per_share
        const payout = Number(BigInt(winningShares) * BigInt(Math.round(payoutPerShare)));
        const costBasis = existing.total_yes_cost + existing.total_no_cost;
        const pnl = payout - costBasis;
        const query = `
      UPDATE user_positions 
      SET 
        yes_shares = 0,
        no_shares = 0,
        total_yes_cost = 0,
        total_no_cost = 0,
        realized_pnl = realized_pnl + $3,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE user_id = $1 AND option_id = $2
      RETURNING *
    `;
        const result = await db.query(query, [user_id, option_id, pnl]);
        return result.rows[0] ? { position: result.rows[0], payout } : null;
    }
    /**
     * Get total position value for a user across all markets
     */
    static async getTotalPositionValue(user_id, client) {
        const db = client || db_1.pool;
        const result = await db.query(`SELECT SUM(total_yes_cost + total_no_cost) as total_value 
       FROM user_positions 
       WHERE user_id = $1`, [user_id]);
        return parseFloat(result.rows[0]?.total_value || "0");
    }
    /**
     * Get leaderboard of users by realized PnL
     */
    static async getLeaderboard(limit = 100, client) {
        const db = client || db_1.pool;
        const result = await db.query(`SELECT user_id, SUM(realized_pnl) as total_pnl 
       FROM user_positions 
       GROUP BY user_id 
       ORDER BY total_pnl DESC 
       LIMIT $1`, [limit]);
        return result.rows;
    }
}
exports.UserPositionModel = UserPositionModel;
//# sourceMappingURL=UserPosition.js.map