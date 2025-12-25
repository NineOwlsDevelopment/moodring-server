"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithdrawalModel = void 0;
const db_1 = require("../db");
class WithdrawalModel {
    static async create(data, client) {
        const { user_id, wallet_id, destination_address, amount, token_symbol, status = "pending", idempotency_key = null, } = data;
        const db = client || db_1.pool;
        const now = Math.floor(Date.now() / 1000);
        const query = `
      INSERT INTO withdrawals (user_id, wallet_id, destination_address, amount, token_symbol, status, idempotency_key, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
        const result = await db.query(query, [
            user_id,
            wallet_id,
            destination_address,
            amount,
            token_symbol,
            status,
            idempotency_key,
            now,
            now,
        ]);
        return result.rows[0];
    }
    static async findById(id, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM withdrawals WHERE id = $1", [
            id,
        ]);
        return result.rows[0] || null;
    }
    static async findByUserId(userId, limit = 50, offset = 0, client) {
        const db = client || db_1.pool;
        const [withdrawalsResult, countResult] = await Promise.all([
            db.query(`
        SELECT * FROM withdrawals
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]),
            db.query("SELECT COUNT(*)::int as count FROM withdrawals WHERE user_id = $1", [userId]),
        ]);
        return {
            withdrawals: withdrawalsResult.rows,
            total: countResult.rows[0]?.count || 0,
        };
    }
    static async findPending(client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM withdrawals WHERE status = 'pending' ORDER BY created_at ASC");
        return result.rows;
    }
    static async updateStatus(id, status, transactionSignature, transactionId, failureReason, client) {
        const db = client || db_1.pool;
        const completedAt = status === "completed" ? "EXTRACT(EPOCH FROM NOW())::BIGINT" : "NULL";
        const result = await db.query(`
      UPDATE withdrawals
      SET 
        status = $1, 
        transaction_id = COALESCE($2, transaction_id),
        transaction_signature = COALESCE($3, transaction_signature),
        failure_reason = COALESCE($4, failure_reason),
        completed_at = ${status === "completed"
            ? "EXTRACT(EPOCH FROM NOW())::BIGINT"
            : "completed_at"},
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $5
      RETURNING *
    `, [
            status,
            transactionId || null,
            transactionSignature || null,
            failureReason || null,
            id,
        ]);
        return result.rows[0] || null;
    }
    static async hasPendingWithdrawal(userId, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT 1 FROM withdrawals WHERE user_id = $1 AND status IN ('pending', 'processing') LIMIT 1", [userId]);
        return result.rows.length > 0;
    }
    static async getTotalWithdrawn(userId, client) {
        const db = client || db_1.pool;
        const result = await db.query(`
      SELECT 
        COALESCE(SUM(amount) FILTER (WHERE token_symbol = 'SOL'), 0)::bigint as sol,
        COALESCE(SUM(amount) FILTER (WHERE token_symbol = 'USDC'), 0)::bigint as usdc
      FROM withdrawals
      WHERE user_id = $1 AND status = 'completed'
    `, [userId]);
        return result.rows[0];
    }
}
exports.WithdrawalModel = WithdrawalModel;
//# sourceMappingURL=Withdrawal.js.map