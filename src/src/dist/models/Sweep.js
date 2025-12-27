"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SweepModel = void 0;
const db_1 = require("../db");
class SweepModel {
    /**
     * Create a new sweep record in pending status
     */
    static async create(data, client) {
        const { wallet_id, user_id, deposit_id = null, source_address, destination_address, amount, token_symbol = "USDC", } = data;
        const db = client || db_1.pool;
        const now = Math.floor(Date.now() / 1000);
        const result = await db.query(`INSERT INTO wallet_sweeps (
        wallet_id,
        user_id,
        deposit_id,
        source_address,
        destination_address,
        amount,
        token_symbol,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)
      RETURNING *`, [
            wallet_id,
            user_id,
            deposit_id,
            source_address,
            destination_address,
            amount,
            token_symbol,
            now,
            now,
        ]);
        return result.rows[0];
    }
    /**
     * Mark a sweep as completed with transaction signature
     */
    static async markCompleted(sweepId, transactionSignature, client) {
        const db = client || db_1.pool;
        const result = await db.query(`UPDATE wallet_sweeps
       SET status = 'completed',
           transaction_signature = $2,
           completed_at = EXTRACT(EPOCH FROM NOW())::BIGINT,
           updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
       WHERE id = $1
       RETURNING *`, [sweepId, transactionSignature]);
        return result.rows[0] || null;
    }
    /**
     * Mark a sweep as failed with reason
     */
    static async markFailed(sweepId, failureReason, client) {
        const db = client || db_1.pool;
        const result = await db.query(`UPDATE wallet_sweeps
       SET status = 'failed',
           failure_reason = $2,
           updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
       WHERE id = $1
       RETURNING *`, [sweepId, failureReason]);
        return result.rows[0] || null;
    }
    /**
     * Find sweep by ID
     */
    static async findById(id, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM wallet_sweeps WHERE id = $1", [
            id,
        ]);
        return result.rows[0] || null;
    }
    /**
     * Find all pending sweeps (for retry logic)
     */
    static async findPending(client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM wallet_sweeps WHERE status = 'pending' ORDER BY created_at ASC");
        return result.rows;
    }
    /**
     * Find all failed sweeps (for retry logic)
     */
    static async findFailed(client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM wallet_sweeps WHERE status = 'failed' ORDER BY created_at ASC");
        return result.rows;
    }
    /**
     * Find sweeps by wallet ID
     */
    static async findByWalletId(walletId, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM wallet_sweeps WHERE wallet_id = $1 ORDER BY created_at DESC", [walletId]);
        return result.rows;
    }
    /**
     * Find sweeps by user ID
     */
    static async findByUserId(userId, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM wallet_sweeps WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
        return result.rows;
    }
    /**
     * Get sweep statistics
     */
    static async getStats(client) {
        const db = client || db_1.pool;
        const result = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as total_amount_swept
      FROM wallet_sweeps
    `);
        const row = result.rows[0];
        return {
            total: parseInt(row.total, 10),
            pending: parseInt(row.pending, 10),
            completed: parseInt(row.completed, 10),
            failed: parseInt(row.failed, 10),
            total_amount_swept: parseInt(row.total_amount_swept, 10),
        };
    }
}
exports.SweepModel = SweepModel;
//# sourceMappingURL=Sweep.js.map