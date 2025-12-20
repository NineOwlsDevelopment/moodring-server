import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";

type QueryClient = Pool | PoolClient;

export interface Comment {
  id: UUID;
  user_id: UUID;
  market_id: UUID;
  parent_id: UUID | null;
  content: string;
  is_edited: boolean;
  is_deleted: boolean;
  upvotes: number;
  downvotes: number;
  created_at: number;
  updated_at: number;
}

export interface CommentCreateInput {
  user_id: UUID;
  market_id: UUID | string;
  parent_id?: UUID | null;
  content: string;
}

export interface CommentWithUser extends Comment {
  username: string;
  display_name: string | null;
  user_vote?: "up" | "down" | null;
  reply_count?: number;
}

export interface CommentVote {
  id: UUID;
  comment_id: UUID;
  user_id: UUID;
  vote_type: "up" | "down";
  created_at: number;
}

export class CommentModel {
  static async create(
    data: CommentCreateInput,
    client?: QueryClient
  ): Promise<Comment> {
    const { user_id, market_id, parent_id = null, content } = data;
    const db = client || pool;
    const now = Math.floor(Date.now() / 1000);

    const query = `
      INSERT INTO comments (user_id, market_id, parent_id, content, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await db.query(query, [
      user_id,
      market_id,
      parent_id,
      content,
      now,
      now,
    ]);
    return result.rows[0];
  }

  static async findById(
    id: UUID | string,
    client?: QueryClient
  ): Promise<Comment | null> {
    const db = client || pool;
    const result = await db.query("SELECT * FROM comments WHERE id = $1", [id]);
    return result.rows[0] || null;
  }

  static async findByIdWithUser(
    id: UUID | string,
    currentUserId?: UUID | string,
    client?: QueryClient
  ): Promise<CommentWithUser | null> {
    const db = client || pool;
    const result = await db.query(
      `
      SELECT c.*, u.username, u.display_name,
        cv.vote_type as user_vote,
        COALESCE((SELECT COUNT(*)::int FROM comments WHERE parent_id = c.id AND is_deleted = FALSE), 0) as reply_count
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN comment_votes cv ON cv.comment_id = c.id AND cv.user_id = $2
      WHERE c.id = $1 AND c.is_deleted = FALSE
    `,
      [id, currentUserId || null]
    );
    const row = result.rows[0];
    if (!row) return null;
    // Ensure counts are numbers
    return {
      ...row,
      upvotes: Number(row.upvotes) || 0,
      downvotes: Number(row.downvotes) || 0,
      reply_count: Number(row.reply_count) || 0,
    };
  }

  static async findByMarket(
    marketId: string,
    currentUserId?: UUID | string,
    limit = 50,
    offset = 0,
    sort: "top" | "new" = "new",
    client?: QueryClient
  ): Promise<{ comments: CommentWithUser[]; total: number }> {
    const db = client || pool;

    // Determine ORDER BY clause based on sort parameter
    const orderBy =
      sort === "top"
        ? "(c.upvotes - c.downvotes) DESC, c.created_at DESC"
        : "c.created_at DESC";

    const [commentsResult, countResult] = await Promise.all([
      db.query(
        `
        SELECT c.*, u.username, u.display_name,
          cv.vote_type as user_vote,
          COALESCE((SELECT COUNT(*)::int FROM comments WHERE parent_id = c.id AND is_deleted = FALSE), 0) as reply_count
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN comment_votes cv ON cv.comment_id = c.id AND cv.user_id = $4
        WHERE c.market_id = $1 AND c.parent_id IS NULL AND c.is_deleted = FALSE
        ORDER BY ${orderBy}
        LIMIT $2 OFFSET $3
      `,
        [marketId, limit, offset, currentUserId || null]
      ),
      db.query(
        "SELECT COUNT(*)::int as count FROM comments WHERE market_id = $1 AND parent_id IS NULL AND is_deleted = FALSE",
        [marketId]
      ),
    ]);

    // Ensure counts are numbers
    const comments = commentsResult.rows.map((row) => ({
      ...row,
      upvotes: Number(row.upvotes) || 0,
      downvotes: Number(row.downvotes) || 0,
      reply_count: Number(row.reply_count) || 0,
    }));

    return {
      comments,
      total: Number(countResult.rows[0]?.count) || 0,
    };
  }

  static async findReplies(
    parentId: UUID | string,
    currentUserId?: UUID | string,
    limit = 50,
    offset = 0,
    client?: QueryClient
  ): Promise<CommentWithUser[]> {
    const db = client || pool;
    const result = await db.query(
      `
      SELECT c.*, u.username, u.display_name,
        cv.vote_type as user_vote,
        COALESCE((SELECT COUNT(*)::int FROM comments WHERE parent_id = c.id AND is_deleted = FALSE), 0) as reply_count
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN comment_votes cv ON cv.comment_id = c.id AND cv.user_id = $4
      WHERE c.parent_id = $1 AND c.is_deleted = FALSE
      ORDER BY c.created_at ASC
      LIMIT $2 OFFSET $3
    `,
      [parentId, limit, offset, currentUserId || null]
    );
    // Ensure counts are numbers
    return result.rows.map((row) => ({
      ...row,
      upvotes: Number(row.upvotes) || 0,
      downvotes: Number(row.downvotes) || 0,
      reply_count: Number(row.reply_count) || 0,
    }));
  }

  static async update(
    id: UUID | string,
    userId: UUID | string,
    content: string,
    client?: QueryClient
  ): Promise<Comment | null> {
    const db = client || pool;
    const result = await db.query(
      `
      UPDATE comments
      SET content = $1, is_edited = TRUE, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $2 AND user_id = $3 AND is_deleted = FALSE
      RETURNING *
    `,
      [content, id, userId]
    );
    return result.rows[0] || null;
  }

  static async softDelete(
    id: UUID | string,
    userId: UUID | string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const result = await db.query(
      `
      UPDATE comments
      SET is_deleted = TRUE, content = '[deleted]', updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `,
      [id, userId]
    );
    return result.rows.length > 0;
  }

  static async vote(
    commentId: UUID | string,
    userId: UUID | string,
    voteType: "up" | "down"
  ): Promise<{ upvotes: number; downvotes: number }> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Check if user already voted
      const existingVote = await client.query(
        "SELECT vote_type FROM comment_votes WHERE comment_id = $1 AND user_id = $2",
        [commentId, userId]
      );

      if (existingVote.rows.length > 0) {
        const oldVoteType = existingVote.rows[0].vote_type;

        if (oldVoteType === voteType) {
          // Remove vote (toggle off)
          await client.query(
            "DELETE FROM comment_votes WHERE comment_id = $1 AND user_id = $2",
            [commentId, userId]
          );
          await client.query(
            `UPDATE comments SET ${
              voteType === "up" ? "upvotes" : "downvotes"
            } = ${
              voteType === "up" ? "upvotes" : "downvotes"
            } - 1 WHERE id = $1`,
            [commentId]
          );
        } else {
          // Change vote
          await client.query(
            "UPDATE comment_votes SET vote_type = $1 WHERE comment_id = $2 AND user_id = $3",
            [voteType, commentId, userId]
          );
          await client.query(
            `UPDATE comments SET 
              upvotes = upvotes ${voteType === "up" ? "+ 1" : "- 1"},
              downvotes = downvotes ${voteType === "down" ? "+ 1" : "- 1"}
            WHERE id = $1`,
            [commentId]
          );
        }
      } else {
        // New vote
        const now = Math.floor(Date.now() / 1000);
        await client.query(
          "INSERT INTO comment_votes (comment_id, user_id, vote_type, created_at) VALUES ($1, $2, $3, $4)",
          [commentId, userId, voteType, now]
        );
        await client.query(
          `UPDATE comments SET ${
            voteType === "up" ? "upvotes" : "downvotes"
          } = ${voteType === "up" ? "upvotes" : "downvotes"} + 1 WHERE id = $1`,
          [commentId]
        );
      }

      // Get updated counts
      const result = await client.query(
        "SELECT upvotes, downvotes FROM comments WHERE id = $1",
        [commentId]
      );

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async getUserCommentCount(
    userId: UUID | string,
    client?: QueryClient
  ): Promise<number> {
    const db = client || pool;
    const result = await db.query(
      "SELECT COUNT(*)::int as count FROM comments WHERE user_id = $1 AND is_deleted = FALSE",
      [userId]
    );
    return result.rows[0]?.count || 0;
  }
}
