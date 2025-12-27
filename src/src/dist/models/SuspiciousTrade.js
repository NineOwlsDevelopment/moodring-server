"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuspiciousTradeModel = void 0;
const db_1 = require("../db");
class SuspiciousTradeModel {
    static async create(data, client) {
        const { trade_id = null, user_id, market_id, option_id = null, trade_type, side = null, quantity = null, price_per_share = null, total_amount, detection_reason, detection_metadata = {}, review_status = "pending", reviewed_by = null, reviewed_at = null, review_notes = null, risk_score = 0, automated_action_taken = false, manual_action_required = true, } = data;
        const db = client || db_1.pool;
        const now = Math.floor(Date.now() / 1000);
        const query = `
      INSERT INTO suspicious_trades (
        trade_id, user_id, market_id, option_id, trade_type, side,
        quantity, price_per_share, total_amount, detection_reason,
        detection_metadata, review_status, reviewed_by, reviewed_at,
        review_notes, risk_score, automated_action_taken, manual_action_required,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `;
        const values = [
            trade_id,
            user_id,
            market_id,
            option_id,
            trade_type,
            side,
            quantity,
            price_per_share,
            total_amount,
            detection_reason,
            JSON.stringify(detection_metadata),
            review_status,
            reviewed_by,
            reviewed_at,
            review_notes,
            risk_score,
            automated_action_taken,
            manual_action_required,
            now,
            now,
        ];
        const result = await db.query(query, values);
        return result.rows[0];
    }
    static async findById(id, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM suspicious_trades WHERE id = $1", [id]);
        return result.rows[0] || null;
    }
    static async findPending(limit = 50, offset = 0, client) {
        const db = client || db_1.pool;
        const [tradesResult, countResult] = await Promise.all([
            db.query(`
        SELECT st.*, m.question as market_question, o.option_label, u.username,
               r.username as reviewer_username
        FROM suspicious_trades st
        LEFT JOIN markets m ON st.market_id = m.id
        LEFT JOIN market_options o ON st.option_id = o.id
        LEFT JOIN users u ON st.user_id = u.id
        LEFT JOIN users r ON st.reviewed_by = r.id
        WHERE st.review_status = 'pending'
        ORDER BY st.created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
            db.query("SELECT COUNT(*) as total FROM suspicious_trades WHERE review_status = 'pending'"),
        ]);
        return {
            suspiciousTrades: tradesResult.rows,
            total: parseInt(countResult.rows[0].total),
        };
    }
    static async findByUserId(userId, limit = 50, offset = 0, client) {
        const db = client || db_1.pool;
        const [tradesResult, countResult] = await Promise.all([
            db.query(`
        SELECT st.*, m.question as market_question, o.option_label, u.username,
               r.username as reviewer_username
        FROM suspicious_trades st
        LEFT JOIN markets m ON st.market_id = m.id
        LEFT JOIN market_options o ON st.option_id = o.id
        LEFT JOIN users u ON st.user_id = u.id
        LEFT JOIN users r ON st.reviewed_by = r.id
        WHERE st.user_id = $1
        ORDER BY st.created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]),
            db.query("SELECT COUNT(*) as total FROM suspicious_trades WHERE user_id = $1", [userId]),
        ]);
        return {
            suspiciousTrades: tradesResult.rows,
            total: parseInt(countResult.rows[0].total),
        };
    }
    static async updateReviewStatus(id, reviewData, client) {
        const db = client || db_1.pool;
        const { review_status, reviewed_by, reviewed_at, review_notes, risk_score, manual_action_required, } = reviewData;
        const query = `
      UPDATE suspicious_trades
      SET review_status = $1, reviewed_by = $2, reviewed_at = $3,
          review_notes = $4, risk_score = $5, manual_action_required = $6,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $7
      RETURNING *
    `;
        const values = [
            review_status,
            reviewed_by || null,
            reviewed_at || null,
            review_notes || null,
            risk_score || 0,
            manual_action_required !== undefined ? manual_action_required : true,
            id,
        ];
        const result = await db.query(query, values);
        return result.rows[0] || null;
    }
    static async getStats(client) {
        const db = client || db_1.pool;
        const result = await db.query(`
      SELECT
        COUNT(CASE WHEN review_status = 'pending' THEN 1 END) as total_pending,
        COUNT(CASE WHEN review_status = 'reviewed' THEN 1 END) as total_reviewed,
        COUNT(CASE WHEN review_status = 'flagged' THEN 1 END) as total_flagged,
        ROUND(AVG(CASE WHEN risk_score > 0 THEN risk_score END), 2) as average_risk_score
      FROM suspicious_trades
    `);
        return {
            total_pending: parseInt(result.rows[0].total_pending),
            total_reviewed: parseInt(result.rows[0].total_reviewed),
            total_flagged: parseInt(result.rows[0].total_flagged),
            average_risk_score: parseFloat(result.rows[0].average_risk_score) || 0,
        };
    }
}
exports.SuspiciousTradeModel = SuspiciousTradeModel;
//# sourceMappingURL=SuspiciousTrade.js.map