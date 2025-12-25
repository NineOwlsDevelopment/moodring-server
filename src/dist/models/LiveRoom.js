"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveRoomModel = void 0;
const db_1 = require("../db");
class LiveRoomModel {
    /**
     * Create or get existing room for a market
     */
    static async getOrCreateForMarket(marketId, client) {
        const db = client || db_1.pool;
        // First try to find existing active room
        const existing = await this.findActiveByMarket(marketId, client);
        if (existing) {
            return existing;
        }
        // Create new room
        const now = Math.floor(Date.now() / 1000);
        const query = `
      INSERT INTO live_rooms (market_id, name, is_active, created_at, updated_at)
      VALUES ($1, 'Market Live Room', true, $2, $3)
      RETURNING *
    `;
        const result = await db.query(query, [marketId, now, now]);
        return result.rows[0];
    }
    /**
     * Find active room for a market
     */
    static async findActiveByMarket(marketId, client) {
        const db = client || db_1.pool;
        const query = `
      SELECT * FROM live_rooms 
      WHERE market_id = $1 AND is_active = true
      LIMIT 1
    `;
        const result = await db.query(query, [marketId]);
        return result.rows[0] || null;
    }
    /**
     * Find room by ID with participants
     */
    static async findByIdWithParticipants(roomId, client) {
        const db = client || db_1.pool;
        const roomQuery = `SELECT * FROM live_rooms WHERE id = $1`;
        const roomResult = await db.query(roomQuery, [roomId]);
        if (roomResult.rows.length === 0) {
            return null;
        }
        const room = roomResult.rows[0];
        const participantsQuery = `
      SELECT 
        lrp.*,
        u.username,
        u.display_name
      FROM live_room_participants lrp
      JOIN users u ON lrp.user_id = u.id
      WHERE lrp.room_id = $1 AND lrp.left_at IS NULL
      ORDER BY 
        CASE lrp.role 
          WHEN 'host' THEN 1 
          WHEN 'speaker' THEN 2 
          ELSE 3 
        END,
        lrp.joined_at ASC
    `;
        const participantsResult = await db.query(participantsQuery, [roomId]);
        return {
            ...room,
            participants: participantsResult.rows,
        };
    }
    /**
     * Add participant to room
     */
    static async addParticipant(roomId, userId, role = "listener", client) {
        const db = client || db_1.pool;
        // Check if already in room
        const existing = await this.getParticipant(roomId, userId, client);
        if (existing) {
            return existing;
        }
        const now = Math.floor(Date.now() / 1000);
        const query = `
      INSERT INTO live_room_participants (room_id, user_id, role, joined_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
        const result = await db.query(query, [roomId, userId, role, now]);
        // Update participant count
        await db.query(`UPDATE live_rooms SET current_participant_count = current_participant_count + 1 WHERE id = $1`, [roomId]);
        return result.rows[0];
    }
    /**
     * Remove participant from room
     */
    static async removeParticipant(roomId, userId, client) {
        const db = client || db_1.pool;
        const query = `
      UPDATE live_room_participants 
      SET left_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
      RETURNING id
    `;
        const result = await db.query(query, [roomId, userId]);
        if (result.rows.length > 0) {
            // Update participant count
            await db.query(`UPDATE live_rooms SET current_participant_count = GREATEST(0, current_participant_count - 1) WHERE id = $1`, [roomId]);
            return true;
        }
        return false;
    }
    /**
     * Get participant record
     */
    static async getParticipant(roomId, userId, client) {
        const db = client || db_1.pool;
        const query = `
      SELECT * FROM live_room_participants
      WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
    `;
        const result = await db.query(query, [roomId, userId]);
        return result.rows[0] || null;
    }
    /**
     * Update participant state (mute, video, etc.)
     */
    static async updateParticipantState(roomId, userId, updates, client) {
        const db = client || db_1.pool;
        const setClauses = [];
        const values = [];
        let paramCount = 1;
        Object.entries(updates).forEach(([key, value]) => {
            if (value !== undefined) {
                setClauses.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        });
        if (setClauses.length === 0)
            return null;
        values.push(roomId, userId);
        const query = `
      UPDATE live_room_participants
      SET ${setClauses.join(", ")}
      WHERE room_id = $${paramCount} AND user_id = $${paramCount + 1} AND left_at IS NULL
      RETURNING *
    `;
        const result = await db.query(query, values);
        return result.rows[0] || null;
    }
    /**
     * Promote participant to speaker
     */
    static async promoteToSpeaker(roomId, userId, client) {
        const db = client || db_1.pool;
        const query = `
      UPDATE live_room_participants
      SET role = 'speaker'
      WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
      RETURNING *
    `;
        const result = await db.query(query, [roomId, userId]);
        return result.rows[0] || null;
    }
    /**
     * Demote participant to listener
     */
    static async demoteToListener(roomId, userId, client) {
        const db = client || db_1.pool;
        const query = `
      UPDATE live_room_participants
      SET role = 'listener', is_muted = true, is_video_on = false
      WHERE room_id = $1 AND user_id = $2 AND role != 'host' AND left_at IS NULL
      RETURNING *
    `;
        const result = await db.query(query, [roomId, userId]);
        return result.rows[0] || null;
    }
    /**
     * Get active rooms with participant counts
     */
    static async getActiveRooms(limit = 20, client) {
        const db = client || db_1.pool;
        const query = `
      SELECT 
        lr.*,
        m.question as market_question
      FROM live_rooms lr
      JOIN markets m ON lr.market_id = m.id
      WHERE lr.is_active = true AND lr.current_participant_count > 0
      ORDER BY lr.current_participant_count DESC
      LIMIT $1
    `;
        const result = await db.query(query, [limit]);
        return result.rows;
    }
    /**
     * Close a room
     */
    static async closeRoom(roomId, client) {
        const db = client || db_1.pool;
        // Mark all participants as left
        await db.query(`UPDATE live_room_participants SET left_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE room_id = $1 AND left_at IS NULL`, [roomId]);
        // Deactivate room
        const result = await db.query(`UPDATE live_rooms SET is_active = false, current_participant_count = 0 WHERE id = $1 RETURNING id`, [roomId]);
        return result.rows.length > 0;
    }
}
exports.LiveRoomModel = LiveRoomModel;
//# sourceMappingURL=LiveRoom.js.map