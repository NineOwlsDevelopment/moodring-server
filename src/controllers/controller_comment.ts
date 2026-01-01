import { Response } from "express";
import { CommentModel } from "../models/Comment";
import { ActivityModel } from "../models/Activity";
import { NotificationModel } from "../models/Notification";
import { pool } from "../db";
import { emitCommentUpdate } from "../services/websocket";
import {
  sendError,
  sendNotFound,
  sendSuccess,
  sendValidationError,
  sendForbidden,
} from "../utils/errors";
import { validateRequired, validateLength } from "../utils/validation";
import { validateTextContent } from "../utils/contentModeration";
import { UUID } from "crypto";
import {
  CreateCommentRequest,
  GetMarketCommentsRequest,
  GetCommentRepliesRequest,
  UpdateCommentRequest,
  DeleteCommentRequest,
  VoteCommentRequest,
} from "../types/requests";

/**
 * @route POST /api/comments
 * @desc Create a new comment
 * @access Private
 */
export const createComment = async (
  req: CreateCommentRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    const { market_id, content, parent_id } = req.body;

    // Validate required fields
    const contentValidation = validateLength(
      content?.trim(),
      "Comment content",
      1,
      2000
    );
    if (!contentValidation.isValid) {
      return sendValidationError(res, contentValidation.error!);
    }

    // Check for banned words in comment content
    const bannedWordsCheck = validateTextContent(
      content?.trim() || "",
      "Comment content"
    );
    if (!bannedWordsCheck.isValid) {
      return sendValidationError(res, bannedWordsCheck.error!);
    }

    // Verify market exists
    const marketResult = await pool.query(
      "SELECT id, question FROM markets WHERE id = $1",
      [market_id]
    );

    if (marketResult.rows.length === 0) {
      return sendNotFound(res, "Market");
    }

    // Check if user has made at least one trade on this market
    const tradeCountResult = await pool.query(
      `SELECT COUNT(*)::int as trade_count
       FROM trades
       WHERE user_id = $1 AND market_id = $2 AND status = 'completed'`,
      [userId, market_id]
    );

    const tradeCount = Number(tradeCountResult.rows[0]?.trade_count || 0);
    if (tradeCount === 0) {
      return sendForbidden(
        res,
        "You must make at least one trade on this market before you can comment"
      );
    }

    // If it's a reply, verify parent comment exists
    let parentComment = null;
    if (parent_id) {
      parentComment = await CommentModel.findById(parent_id);
      if (!parentComment) {
        return sendNotFound(res, "Parent comment");
      }
    }

    // Create the comment
    const comment = await CommentModel.create({
      user_id: userId as UUID,
      market_id: market_id as UUID | string,
      parent_id: (parent_id || null) as UUID | null,
      content: content.trim(),
    });

    // Get comment with user details
    const commentWithUser = await CommentModel.findByIdWithUser(
      comment.id,
      userId
    );

    // Record activity
    await ActivityModel.create({
      user_id: userId as UUID,
      activity_type: "comment",
      entity_type: "comment",
      entity_id: comment.id,
      metadata: {
        market_id,
        is_reply: !!parent_id,
        parent_id: parent_id || null,
      },
    });

    // If it's a reply, notify the parent comment author
    if (parentComment && parentComment.user_id !== userId) {
      await NotificationModel.create({
        user_id: parentComment.user_id,
        notification_type: "comment_reply",
        title: "New Reply to Your Comment",
        message: `Someone replied to your comment on "${marketResult.rows[0].question}"`,
        entity_type: "comment",
        entity_id: comment.id,
        metadata: {
          market_id,
          parent_comment_id: parent_id,
        },
      });
    }

    // Emit realtime comment update
    emitCommentUpdate({
      comment_id: comment.id,
      market_id,
      parent_id: parent_id || null,
      event: "created",
      comment: commentWithUser,
      timestamp: new Date(),
    });

    return sendSuccess(
      res,
      {
        message: "Comment created successfully",
        comment: commentWithUser,
      },
      201
    );
  } catch (error: any) {
    console.error("Create comment error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/comments/market/:id
 * @desc Get comments for a market
 * @access Public
 */
export const getMarketComments = async (
  req: GetMarketCommentsRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const currentUserId = req.id; // May be undefined if not authenticated

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = (page - 1) * limit;
    const sort = (req.query.sort as string) === "top" ? "top" : "new";

    const { comments, total } = await CommentModel.findByMarket(
      id,
      currentUserId,
      limit,
      offset,
      sort
    );

    const totalPages = Math.ceil(total / limit);

    return sendSuccess(res, {
      comments,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error: any) {
    console.error("Get market comments error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/comments/:id/replies
 * @desc Get replies to a comment
 * @access Public (optional auth)
 */
export const getCommentReplies = async (
  req: GetCommentRepliesRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const currentUserId = req.id; // May be undefined if not authenticated
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const replies = await CommentModel.findReplies(
      id,
      currentUserId,
      limit,
      offset
    );

    return sendSuccess(res, {
      replies,
      pagination: {
        offset,
        limit,
        hasMore: replies.length === limit,
      },
    });
  } catch (error: any) {
    console.error("Get comment replies error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route PUT /api/comments/:id
 * @desc Update a comment
 * @access Private
 */
export const updateComment = async (
  req: UpdateCommentRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    const { id } = req.params;
    const { content } = req.body;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    // Validate content
    const contentValidation = validateLength(
      content?.trim(),
      "Comment content",
      1,
      2000
    );
    if (!contentValidation.isValid) {
      return sendValidationError(res, contentValidation.error!);
    }

    // Check for banned words in comment content
    const bannedWordsCheck = validateTextContent(
      content?.trim() || "",
      "Comment content"
    );
    if (!bannedWordsCheck.isValid) {
      return sendValidationError(res, bannedWordsCheck.error!);
    }

    const comment = await CommentModel.update(id, userId, content.trim());

    if (!comment) {
      return sendNotFound(res, "Comment");
    }

    const commentWithUser = await CommentModel.findByIdWithUser(
      comment.id,
      userId
    );

    // Emit realtime comment update
    emitCommentUpdate({
      comment_id: comment.id,
      market_id: comment.market_id,
      parent_id: comment.parent_id,
      event: "updated",
      comment: commentWithUser,
      timestamp: new Date(),
    });

    return sendSuccess(res, {
      message: "Comment updated successfully",
      comment: commentWithUser,
    });
  } catch (error: any) {
    console.error("Update comment error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route DELETE /api/comments/:id
 * @desc Delete a comment (soft delete)
 * @access Private
 */
export const deleteComment = async (
  req: DeleteCommentRequest,
  res: Response
) => {
  try {
    const userId = req.id;

    const { id } = req.params;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    const comment = await CommentModel.findById(id);
    if (!comment) {
      return sendNotFound(res, "Comment");
    }

    const success = await CommentModel.softDelete(id, userId);

    if (!success) {
      return sendNotFound(res, "Comment");
    }

    // Emit realtime comment update
    emitCommentUpdate({
      comment_id: id,
      market_id: comment.market_id,
      parent_id: comment.parent_id,
      event: "deleted",
      timestamp: new Date(),
    });

    return sendSuccess(res, { message: "Comment deleted successfully" });
  } catch (error: any) {
    console.error("Delete comment error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route POST /api/comments/:id/vote
 * @desc Vote on a comment
 * @access Private
 */
export const voteComment = async (req: VoteCommentRequest, res: Response) => {
  try {
    const userId = req.id;
    const { id } = req.params;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    // Support both 'vote' and 'vote_type' for compatibility
    const vote = req.body.vote || req.body.vote_type;

    if (!vote || !["up", "down", "none"].includes(vote)) {
      return sendValidationError(res, "vote must be 'up', 'down', or 'none'");
    }

    // Verify comment exists
    const comment = await CommentModel.findById(id);
    if (!comment || comment.is_deleted) {
      return sendNotFound(res, "Comment");
    }

    // Can't vote on your own comment
    if (comment.user_id === userId) {
      return sendValidationError(res, "You cannot vote on your own comment");
    }

    // Handle "none" to remove vote
    if (vote === "none") {
      // Check if user has a vote to remove
      const existingVote = await pool.query(
        "SELECT vote_type FROM comment_votes WHERE comment_id = $1 AND user_id = $2",
        [id, userId]
      );

      if (existingVote.rows.length > 0) {
        const oldVoteType = existingVote.rows[0].vote_type;
        const result = await CommentModel.vote(id, userId, oldVoteType); // Toggle off

        // Emit realtime comment update
        emitCommentUpdate({
          comment_id: id,
          market_id: comment.market_id,
          parent_id: comment.parent_id,
          event: "voted",
          upvotes: result.upvotes,
          downvotes: result.downvotes,
          timestamp: new Date(),
        });

        return sendSuccess(res, {
          message: "Vote removed",
          upvotes: result.upvotes,
          downvotes: result.downvotes,
        });
      } else {
        // No vote to remove, just return current counts
        return sendSuccess(res, {
          message: "No vote to remove",
          upvotes: comment.upvotes,
          downvotes: comment.downvotes,
        });
      }
    }

    const result = await CommentModel.vote(id, userId, vote);

    // Emit realtime comment update
    emitCommentUpdate({
      comment_id: id,
      market_id: comment.market_id,
      parent_id: comment.parent_id,
      event: "voted",
      upvotes: result.upvotes,
      downvotes: result.downvotes,
      timestamp: new Date(),
    });

    return sendSuccess(res, {
      message: "Vote recorded",
      upvotes: result.upvotes,
      downvotes: result.downvotes,
    });
  } catch (error: any) {
    console.error("Vote comment error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};
