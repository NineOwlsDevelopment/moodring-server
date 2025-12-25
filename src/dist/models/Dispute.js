"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisputeModel = void 0;
const db_1 = require("../db");
class DisputeModel {
    static async create(data, client) {
        const db = client || db_1.pool;
        const now = Math.floor(Date.now() / 1000);
        const query = `
      INSERT INTO disputes (
        market_id, option_id, user_id, reason, evidence,
        resolution_fee_paid, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
        const values = [
            data.market_id,
            data.option_id,
            data.user_id,
            data.reason,
            data.evidence || null,
            data.resolution_fee_paid,
            "pending",
            now,
            now,
        ];
        const result = await db.query(query, values);
        return result.rows[0];
    }
    static async findByMarket(marketId, client) {
        const db = client || db_1.pool;
        const query = `
      SELECT * FROM disputes
      WHERE market_id = $1
      ORDER BY created_at DESC
    `;
        const result = await db.query(query, [marketId]);
        return result.rows;
    }
    static async findByOption(optionId, client) {
        const db = client || db_1.pool;
        const query = `
      SELECT * FROM disputes
      WHERE option_id = $1
      ORDER BY created_at DESC
    `;
        const result = await db.query(query, [optionId]);
        return result.rows;
    }
    static async findByUser(userId, client) {
        const db = client || db_1.pool;
        const query = `
      SELECT * FROM disputes
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
        const result = await db.query(query, [userId]);
        return result.rows;
    }
    static async findById(disputeId, client) {
        const db = client || db_1.pool;
        const query = `SELECT * FROM disputes WHERE id = $1`;
        const result = await db.query(query, [disputeId]);
        if (result.rows.length === 0)
            return null;
        return result.rows[0];
    }
    static async update(disputeId, data, client) {
        const db = client || db_1.pool;
        const now = Math.floor(Date.now() / 1000);
        const updates = [];
        const values = [];
        let paramCount = 1;
        if (data.status !== undefined) {
            updates.push(`status = $${paramCount++}`);
            values.push(data.status);
        }
        if (data.reviewed_by !== undefined) {
            updates.push(`reviewed_by = $${paramCount++}`);
            values.push(data.reviewed_by);
        }
        if (data.reviewed_at !== undefined) {
            updates.push(`reviewed_at = $${paramCount++}`);
            values.push(data.reviewed_at);
        }
        if (data.review_notes !== undefined) {
            updates.push(`review_notes = $${paramCount++}`);
            values.push(data.review_notes);
        }
        updates.push(`updated_at = $${paramCount++}`);
        values.push(now);
        values.push(disputeId);
        const query = `
      UPDATE disputes
      SET ${updates.join(", ")}
      WHERE id = $${paramCount}
      RETURNING *
    `;
        const result = await db.query(query, values);
        return result.rows[0];
    }
    static async findAll(options = {}, client) {
        const db = client || db_1.pool;
        const limit = options.limit || 50;
        const offset = options.offset || 0;
        const conditions = [];
        const values = [];
        let paramCount = 1;
        if (options.status) {
            conditions.push(`d.status = $${paramCount++}`);
            values.push(options.status);
        }
        if (options.market_id) {
            conditions.push(`d.market_id = $${paramCount++}`);
            values.push(options.market_id);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const [disputesResult, countResult] = await Promise.all([
            db.query(`
        SELECT 
          d.*,
          m.question as market_question,
          o.option_label,
          u.username as user_username,
          u.display_name as user_display_name,
          r.username as reviewer_username,
          r.display_name as reviewer_display_name
        FROM disputes d
        LEFT JOIN markets m ON d.market_id = m.id
        LEFT JOIN market_options o ON d.option_id = o.id
        LEFT JOIN users u ON d.user_id = u.id
        LEFT JOIN users r ON d.reviewed_by = r.id
        ${whereClause}
        ORDER BY d.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `, [...values, limit, offset]),
            db.query(`
        SELECT COUNT(*) as total FROM disputes d ${whereClause}
      `, values),
        ]);
        return {
            disputes: disputesResult.rows,
            total: parseInt(countResult.rows[0].total),
        };
    }
}
exports.DisputeModel = DisputeModel;
//# sourceMappingURL=Dispute.js.map