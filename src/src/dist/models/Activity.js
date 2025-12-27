"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityModel = void 0;
const db_1 = require("../db");
class ActivityModel {
    static async create(data, client) {
        const { user_id = null, activity_type, entity_type = null, entity_id = null, metadata = null, is_public = true, } = data;
        const db = client || db_1.pool;
        const now = Math.floor(Date.now() / 1000);
        const query = `
      INSERT INTO activities (user_id, activity_type, entity_type, entity_id, metadata, is_public, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
        const result = await db.query(query, [
            user_id,
            activity_type,
            entity_type,
            entity_id,
            metadata ? JSON.stringify(metadata) : null,
            is_public,
            now,
        ]);
        return result.rows[0];
    }
    static async getPublicFeed(limit = 50, offset = 0, client) {
        const db = client || db_1.pool;
        const result = await db.query(`
      SELECT 
        a.*, 
        u.username, 
        u.display_name,
        u.avatar_url,
        CASE 
          WHEN a.entity_type = 'market' THEN a.entity_id::text
          WHEN a.metadata->>'market_id' IS NOT NULL THEN a.metadata->>'market_id'
          ELSE NULL
        END as market_id,
        m.question as market_question
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT question 
        FROM markets 
        WHERE (
          (a.entity_type = 'market' AND id::text = a.entity_id) OR
          (a.metadata->>'market_id' IS NOT NULL AND id::text = a.metadata->>'market_id')
        )
        LIMIT 1
      ) m ON true
      WHERE a.is_public = TRUE
      ORDER BY a.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
        return result.rows;
    }
    static async getUserActivity(userId, limit = 50, offset = 0, activityType, client) {
        const db = client || db_1.pool;
        const typeFilter = activityType ? "AND a.activity_type = $4" : "";
        const params = activityType
            ? [userId, limit, offset, activityType]
            : [userId, limit, offset];
        const result = await db.query(`
      SELECT 
        a.*,
        u.username,
        u.display_name,
        u.avatar_url
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.user_id = $1 ${typeFilter}
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET $3
    `, params);
        return result.rows;
    }
    static async getMarketActivity(marketId, limit = 50, offset = 0, client) {
        const db = client || db_1.pool;
        const result = await db.query(`
      SELECT 
        a.*, 
        u.username, 
        u.display_name,
        u.avatar_url,
        $1::text as market_id,
        m.question as market_question
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN markets m ON m.id::text = $1
      WHERE (a.entity_type = 'market' AND a.entity_id::text = $1)
         OR (a.entity_type = 'option' AND a.metadata->>'market_id' = $1)
         OR (a.entity_type = 'trade' AND a.metadata->>'market_id' = $1)
         OR (a.entity_id::text = $1)
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET $3
    `, [marketId, limit, offset]);
        return result.rows;
    }
    static async getByType(activityType, limit = 50, offset = 0, client) {
        const db = client || db_1.pool;
        const result = await db.query(`
      SELECT 
        a.*, 
        u.username, 
        u.display_name,
        u.avatar_url,
        CASE 
          WHEN a.entity_type = 'market' THEN a.entity_id::text
          WHEN a.metadata->>'market_id' IS NOT NULL THEN a.metadata->>'market_id'
          ELSE NULL
        END as market_id,
        m.question as market_question
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT question 
        FROM markets 
        WHERE (
          (a.entity_type = 'market' AND id::text = a.entity_id) OR
          (a.metadata->>'market_id' IS NOT NULL AND id::text = a.metadata->>'market_id')
        )
        LIMIT 1
      ) m ON true
      WHERE a.activity_type = $1 AND a.is_public = TRUE
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET $3
    `, [activityType, limit, offset]);
        return result.rows;
    }
    static async getRecentByEntity(entityType, entityId, limit = 20, client) {
        const db = client || db_1.pool;
        const result = await db.query(`
      SELECT a.*, u.username, u.display_name, u.avatar_url
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.entity_type = $1 AND a.entity_id = $2
      ORDER BY a.created_at DESC
      LIMIT $3
    `, [entityType, entityId, limit]);
        return result.rows;
    }
}
exports.ActivityModel = ActivityModel;
//# sourceMappingURL=Activity.js.map