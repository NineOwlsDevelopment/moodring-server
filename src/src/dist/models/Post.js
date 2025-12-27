"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostCommentModel = exports.PostModel = void 0;
const db_1 = require("../db");
class PostModel {
    /**
     * Create a new post
     */
    static async create(data, client) {
        const { user_id, content, image_url, market_id, parent_post_id } = data;
        const db = client || db_1.pool;
        // Validate required fields
        if (!content || typeof content !== "string") {
            throw new Error("Content is required and must be a string");
        }
        // Ensure all values are properly typed (convert undefined to null)
        const imageUrl = image_url ?? null;
        const marketId = market_id ?? null;
        const parentPostId = parent_post_id ?? null;
        const now = Math.floor(Date.now() / 1000);
        const query = `
      INSERT INTO posts (user_id, content, image_url, market_id, parent_post_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
        const result = await db.query(query, [
            user_id,
            content,
            imageUrl,
            marketId,
            parentPostId,
            now,
            now,
        ]);
        // Update user's post count
        await db.query("UPDATE users SET posts_count = posts_count + 1 WHERE id = $1", [user_id]);
        return result.rows[0];
    }
    /**
     * Get post by ID with user info
     */
    static async findById(id, currentUserId, client) {
        const db = client || db_1.pool;
        // Use a CTE to cast the parameter first, avoiding type inference issues
        const query = currentUserId
            ? `
      WITH current_user_param AS (
        SELECT $2::uuid as user_id
      )
      SELECT 
        p.*,
        u.username,
        u.display_name,
        COALESCE(pl.likes_count, 0)::int as likes_count,
        COALESCE(pc.comments_count, 0)::int as comments_count,
        COALESCE(pr.replies_count, 0)::int as replies_count,
        EXISTS(
          SELECT 1 FROM post_likes pl2 
          WHERE pl2.post_id = p.id AND pl2.user_id = (SELECT user_id FROM current_user_param)
        ) as is_liked,
        EXISTS(
          SELECT 1 FROM user_follows uf 
          WHERE uf.follower_id = (SELECT user_id FROM current_user_param) AND uf.following_id = p.user_id
        ) as is_following,
        m.question as market_question
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN markets m ON p.market_id = m.id
      LEFT JOIN (
        SELECT post_id, COUNT(*)::int as likes_count
        FROM post_likes
        GROUP BY post_id
      ) pl ON p.id = pl.post_id
      LEFT JOIN (
        SELECT post_id, COUNT(*)::int as comments_count
        FROM post_comments
        WHERE is_deleted = FALSE
        GROUP BY post_id
      ) pc ON p.id = pc.post_id
      LEFT JOIN (
        SELECT parent_post_id, COUNT(*)::int as replies_count
        FROM posts
        WHERE parent_post_id IS NOT NULL AND is_deleted = FALSE
        GROUP BY parent_post_id
      ) pr ON p.id = pr.parent_post_id
      WHERE p.id = $1 AND p.is_deleted = FALSE
    `
            : `
      SELECT 
        p.*,
        u.username,
        u.display_name,
        COALESCE(pl.likes_count, 0)::int as likes_count,
        COALESCE(pc.comments_count, 0)::int as comments_count,
        COALESCE(pr.replies_count, 0)::int as replies_count,
        FALSE as is_liked,
        FALSE as is_following,
        m.question as market_question
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN markets m ON p.market_id = m.id
      LEFT JOIN (
        SELECT post_id, COUNT(*)::int as likes_count
        FROM post_likes
        GROUP BY post_id
      ) pl ON p.id = pl.post_id
      LEFT JOIN (
        SELECT post_id, COUNT(*)::int as comments_count
        FROM post_comments
        WHERE is_deleted = FALSE
        GROUP BY post_id
      ) pc ON p.id = pc.post_id
      LEFT JOIN (
        SELECT parent_post_id, COUNT(*)::int as replies_count
        FROM posts
        WHERE parent_post_id IS NOT NULL AND is_deleted = FALSE
        GROUP BY parent_post_id
      ) pr ON p.id = pr.parent_post_id
      WHERE p.id = $1 AND p.is_deleted = FALSE
    `;
        const result = await db.query(query, currentUserId ? [id, currentUserId] : [id]);
        return result.rows[0] || null;
    }
    /**
     * Get feed posts (following + trending)
     */
    static async getFeed(currentUserId, limit = 20, offset = 0, feedType = "all", client) {
        const db = client || db_1.pool;
        let whereClause = "p.is_deleted = FALSE";
        if (feedType === "following") {
            whereClause += ` AND (
        p.user_id = $3 OR
        EXISTS(SELECT 1 FROM user_follows WHERE follower_id = $3 AND following_id = p.user_id)
      )`;
        }
        const query = `
      SELECT 
        p.*,
        u.username,
        u.display_name,
        COALESCE(pl.likes_count, 0)::int as likes_count,
        COALESCE(pc.comments_count, 0)::int as comments_count,
        COALESCE(pr.replies_count, 0)::int as replies_count,
        EXISTS(
          SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $3
        ) as is_liked,
        EXISTS(
          SELECT 1 FROM user_follows WHERE follower_id = $3 AND following_id = p.user_id
        ) as is_following,
        m.question as market_question
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN markets m ON p.market_id = m.id
      LEFT JOIN (
        SELECT post_id, COUNT(*)::int as likes_count
        FROM post_likes
        GROUP BY post_id
      ) pl ON p.id = pl.post_id
      LEFT JOIN (
        SELECT post_id, COUNT(*)::int as comments_count
        FROM post_comments
        WHERE is_deleted = FALSE
        GROUP BY post_id
      ) pc ON p.id = pc.post_id
      LEFT JOIN (
        SELECT parent_post_id, COUNT(*)::int as replies_count
        FROM posts
        WHERE parent_post_id IS NOT NULL AND is_deleted = FALSE
        GROUP BY parent_post_id
      ) pr ON p.id = pr.parent_post_id
      WHERE ${whereClause} AND p.parent_post_id IS NULL
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `;
        const result = await db.query(query, [limit, offset, currentUserId]);
        return result.rows;
    }
    /**
     * Get user's posts
     */
    static async getByUser(userId, currentUserId, limit = 20, offset = 0, client) {
        const db = client || db_1.pool;
        const query = `
      SELECT 
        p.*,
        u.username,
        u.display_name,
        COALESCE(pl.likes_count, 0)::int as likes_count,
        COALESCE(pc.comments_count, 0)::int as comments_count,
        COALESCE(pr.replies_count, 0)::int as replies_count,
        CASE WHEN $3::uuid IS NOT NULL THEN EXISTS(
          SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $3::uuid
        ) ELSE FALSE END as is_liked,
        CASE WHEN $3::uuid IS NOT NULL THEN EXISTS(
          SELECT 1 FROM user_follows WHERE follower_id = $3::uuid AND following_id = p.user_id
        ) ELSE FALSE END as is_following,
        m.question as market_question
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN markets m ON p.market_id = m.id
      LEFT JOIN (
        SELECT post_id, COUNT(*)::int as likes_count
        FROM post_likes
        GROUP BY post_id
      ) pl ON p.id = pl.post_id
      LEFT JOIN (
        SELECT post_id, COUNT(*)::int as comments_count
        FROM post_comments
        WHERE is_deleted = FALSE
        GROUP BY post_id
      ) pc ON p.id = pc.post_id
      LEFT JOIN (
        SELECT parent_post_id, COUNT(*)::int as replies_count
        FROM posts
        WHERE parent_post_id IS NOT NULL AND is_deleted = FALSE
        GROUP BY parent_post_id
      ) pr ON p.id = pr.parent_post_id
      WHERE p.user_id = $1 AND p.is_deleted = FALSE AND p.parent_post_id IS NULL
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $4
    `;
        const result = await db.query(query, [
            userId,
            limit,
            currentUserId || null,
            offset,
        ]);
        return result.rows;
    }
    /**
     * Like/unlike a post
     */
    static async toggleLike(postId, userId, client) {
        const db = client || db_1.pool;
        await db.query("BEGIN");
        try {
            // Check if already liked
            const existing = await db.query("SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2", [postId, userId]);
            if (existing.rows.length > 0) {
                // Unlike
                await db.query("DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2", [postId, userId]);
                const countResult = await db.query("SELECT COUNT(*)::int as count FROM post_likes WHERE post_id = $1", [postId]);
                await db.query("COMMIT");
                return {
                    liked: false,
                    likes_count: countResult.rows[0].count,
                };
            }
            else {
                // Like
                const now = Math.floor(Date.now() / 1000);
                await db.query("INSERT INTO post_likes (post_id, user_id, created_at) VALUES ($1, $2, $3)", [postId, userId, now]);
                const countResult = await db.query("SELECT COUNT(*)::int as count FROM post_likes WHERE post_id = $1", [postId]);
                await db.query("COMMIT");
                return {
                    liked: true,
                    likes_count: countResult.rows[0].count,
                };
            }
        }
        catch (error) {
            await db.query("ROLLBACK");
            throw error;
        }
    }
    /**
     * Delete a post (soft delete)
     */
    static async delete(postId, userId, client) {
        const db = client || db_1.pool;
        const result = await db.query("UPDATE posts SET is_deleted = TRUE, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $1 AND user_id = $2 RETURNING id", [postId, userId]);
        if (result.rows.length > 0) {
            // Update user's post count
            await db.query("UPDATE users SET posts_count = GREATEST(0, posts_count - 1) WHERE id = $1", [userId]);
            return true;
        }
        return false;
    }
    /**
     * Get replies to a post
     */
    static async getReplies(postId, currentUserId, limit = 20, offset = 0, client) {
        const db = client || db_1.pool;
        const query = `
      SELECT 
        p.*,
        u.username,
        u.display_name,
        COALESCE(pl.likes_count, 0)::int as likes_count,
        0::int as comments_count,
        0::int as replies_count,
        CASE WHEN $3::uuid IS NOT NULL THEN EXISTS(
          SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $3::uuid
        ) ELSE FALSE END as is_liked,
        CASE WHEN $3::uuid IS NOT NULL THEN EXISTS(
          SELECT 1 FROM user_follows WHERE follower_id = $3::uuid AND following_id = p.user_id
        ) ELSE FALSE END as is_following,
        m.question as market_question
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN markets m ON p.market_id = m.id
      LEFT JOIN (
        SELECT post_id, COUNT(*)::int as likes_count
        FROM post_likes
        GROUP BY post_id
      ) pl ON p.id = pl.post_id
      WHERE p.parent_post_id = $1 AND p.is_deleted = FALSE
      ORDER BY p.created_at ASC
      LIMIT $2 OFFSET $4
    `;
        const result = await db.query(query, [
            postId,
            limit,
            currentUserId || null,
            offset,
        ]);
        return result.rows;
    }
}
exports.PostModel = PostModel;
class PostCommentModel {
    /**
     * Create a comment on a post
     */
    static async create(data, client) {
        const { post_id, user_id, content, parent_comment_id = null } = data;
        const db = client || db_1.pool;
        const now = Math.floor(Date.now() / 1000);
        const query = `
      INSERT INTO post_comments (post_id, user_id, content, parent_comment_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
        const result = await db.query(query, [
            post_id,
            user_id,
            content,
            parent_comment_id,
            now,
            now,
        ]);
        return result.rows[0];
    }
    /**
     * Get comments for a post
     */
    static async getByPost(postId, currentUserId, limit = 50, offset = 0, client) {
        const db = client || db_1.pool;
        const query = `
      SELECT 
        pc.*,
        u.username,
        u.display_name,
        0::int as likes_count,
        FALSE as is_liked
      FROM post_comments pc
      LEFT JOIN users u ON pc.user_id = u.id
      WHERE pc.post_id = $1 AND pc.parent_comment_id IS NULL AND pc.is_deleted = FALSE
      ORDER BY pc.created_at ASC
      LIMIT $2 OFFSET $3
    `;
        const result = await db.query(query, [postId, limit, offset]);
        return result.rows;
    }
    /**
     * Get replies to a comment
     */
    static async getReplies(commentId, limit = 20, offset = 0, client) {
        const db = client || db_1.pool;
        const query = `
      SELECT 
        pc.*,
        u.username,
        u.display_name,
        0::int as likes_count,
        FALSE as is_liked
      FROM post_comments pc
      LEFT JOIN users u ON pc.user_id = u.id
      WHERE pc.parent_comment_id = $1 AND pc.is_deleted = FALSE
      ORDER BY pc.created_at ASC
      LIMIT $2 OFFSET $3
    `;
        const result = await db.query(query, [commentId, limit, offset]);
        return result.rows;
    }
    /**
     * Delete a comment (soft delete)
     */
    static async delete(commentId, userId, client) {
        const db = client || db_1.pool;
        const result = await db.query("UPDATE post_comments SET is_deleted = TRUE, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $1 AND user_id = $2 RETURNING id", [commentId, userId]);
        return result.rows.length > 0;
    }
}
exports.PostCommentModel = PostCommentModel;
//# sourceMappingURL=Post.js.map