"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.voteComment = exports.deleteComment = exports.updateComment = exports.getCommentReplies = exports.getMarketComments = exports.createComment = void 0;
const Comment_1 = require("../models/Comment");
const Activity_1 = require("../models/Activity");
const Notification_1 = require("../models/Notification");
const db_1 = require("../db");
const websocket_1 = require("../services/websocket");
const errors_1 = require("../utils/errors");
const validation_1 = require("../utils/validation");
const contentModeration_1 = require("../utils/contentModeration");
/**
 * @route POST /api/comments
 * @desc Create a new comment
 * @access Private
 */
const createComment = async (req, res) => {
    try {
        const userId = req.id;
        const { market_id, content, parent_id } = req.body;
        // Validate required fields
        const contentValidation = (0, validation_1.validateLength)(content?.trim(), "Comment content", 1, 2000);
        if (!contentValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, contentValidation.error);
        }
        // Check for banned words in comment content
        const bannedWordsCheck = (0, contentModeration_1.validateTextContent)(content?.trim() || "", "Comment content");
        if (!bannedWordsCheck.isValid) {
            return (0, errors_1.sendValidationError)(res, bannedWordsCheck.error);
        }
        // Verify market exists
        const marketResult = await db_1.pool.query("SELECT id, question FROM markets WHERE id = $1", [market_id]);
        if (marketResult.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "Market");
        }
        // Check if user has made at least one trade on this market
        const tradeCountResult = await db_1.pool.query(`SELECT COUNT(*)::int as trade_count
       FROM trades
       WHERE user_id = $1 AND market_id = $2 AND status = 'completed'`, [userId, market_id]);
        const tradeCount = Number(tradeCountResult.rows[0]?.trade_count || 0);
        if (tradeCount === 0) {
            return (0, errors_1.sendForbidden)(res, "You must make at least one trade on this market before you can comment");
        }
        // If it's a reply, verify parent comment exists
        let parentComment = null;
        if (parent_id) {
            parentComment = await Comment_1.CommentModel.findById(parent_id);
            if (!parentComment) {
                return (0, errors_1.sendNotFound)(res, "Parent comment");
            }
        }
        // Create the comment
        const comment = await Comment_1.CommentModel.create({
            user_id: userId,
            market_id: market_id,
            parent_id: (parent_id || null),
            content: content.trim(),
        });
        // Get comment with user details
        const commentWithUser = await Comment_1.CommentModel.findByIdWithUser(comment.id, userId);
        // Record activity
        await Activity_1.ActivityModel.create({
            user_id: userId,
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
            await Notification_1.NotificationModel.create({
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
        (0, websocket_1.emitCommentUpdate)({
            comment_id: comment.id,
            market_id,
            parent_id: parent_id || null,
            event: "created",
            comment: commentWithUser,
            timestamp: new Date(),
        });
        return (0, errors_1.sendSuccess)(res, {
            message: "Comment created successfully",
            comment: commentWithUser,
        }, 201);
    }
    catch (error) {
        console.error("Create comment error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.createComment = createComment;
/**
 * @route GET /api/comments/market/:id
 * @desc Get comments for a market
 * @access Public
 */
const getMarketComments = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.id; // May be undefined if not authenticated
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        const sort = req.query.sort === "top" ? "top" : "new";
        const { comments, total } = await Comment_1.CommentModel.findByMarket(id, currentUserId, limit, offset, sort);
        const totalPages = Math.ceil(total / limit);
        return (0, errors_1.sendSuccess)(res, {
            comments,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            },
        });
    }
    catch (error) {
        console.error("Get market comments error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getMarketComments = getMarketComments;
/**
 * @route GET /api/comments/:id/replies
 * @desc Get replies to a comment
 * @access Public
 */
const getCommentReplies = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.id;
        if (!currentUserId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        const replies = await Comment_1.CommentModel.findReplies(id, currentUserId, limit, offset);
        return (0, errors_1.sendSuccess)(res, {
            replies,
            pagination: {
                page,
                limit,
                hasMore: replies.length === limit,
            },
        });
    }
    catch (error) {
        console.error("Get comment replies error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getCommentReplies = getCommentReplies;
/**
 * @route PUT /api/comments/:id
 * @desc Update a comment
 * @access Private
 */
const updateComment = async (req, res) => {
    try {
        const userId = req.id;
        const { id } = req.params;
        const { content } = req.body;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        // Validate content
        const contentValidation = (0, validation_1.validateLength)(content?.trim(), "Comment content", 1, 2000);
        if (!contentValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, contentValidation.error);
        }
        // Check for banned words in comment content
        const bannedWordsCheck = (0, contentModeration_1.validateTextContent)(content?.trim() || "", "Comment content");
        if (!bannedWordsCheck.isValid) {
            return (0, errors_1.sendValidationError)(res, bannedWordsCheck.error);
        }
        const comment = await Comment_1.CommentModel.update(id, userId, content.trim());
        if (!comment) {
            return (0, errors_1.sendNotFound)(res, "Comment");
        }
        const commentWithUser = await Comment_1.CommentModel.findByIdWithUser(comment.id, userId);
        // Emit realtime comment update
        (0, websocket_1.emitCommentUpdate)({
            comment_id: comment.id,
            market_id: comment.market_id,
            parent_id: comment.parent_id,
            event: "updated",
            comment: commentWithUser,
            timestamp: new Date(),
        });
        return (0, errors_1.sendSuccess)(res, {
            message: "Comment updated successfully",
            comment: commentWithUser,
        });
    }
    catch (error) {
        console.error("Update comment error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.updateComment = updateComment;
/**
 * @route DELETE /api/comments/:id
 * @desc Delete a comment (soft delete)
 * @access Private
 */
const deleteComment = async (req, res) => {
    try {
        const userId = req.id;
        const { id } = req.params;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const comment = await Comment_1.CommentModel.findById(id);
        if (!comment) {
            return (0, errors_1.sendNotFound)(res, "Comment");
        }
        const success = await Comment_1.CommentModel.softDelete(id, userId);
        if (!success) {
            return (0, errors_1.sendNotFound)(res, "Comment");
        }
        // Emit realtime comment update
        (0, websocket_1.emitCommentUpdate)({
            comment_id: id,
            market_id: comment.market_id,
            parent_id: comment.parent_id,
            event: "deleted",
            timestamp: new Date(),
        });
        return (0, errors_1.sendSuccess)(res, { message: "Comment deleted successfully" });
    }
    catch (error) {
        console.error("Delete comment error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.deleteComment = deleteComment;
/**
 * @route POST /api/comments/:id/vote
 * @desc Vote on a comment
 * @access Private
 */
const voteComment = async (req, res) => {
    try {
        const userId = req.id;
        const { id } = req.params;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        // Support both 'vote' and 'vote_type' for compatibility
        const vote = req.body.vote || req.body.vote_type;
        if (!vote || !["up", "down", "none"].includes(vote)) {
            return (0, errors_1.sendValidationError)(res, "vote must be 'up', 'down', or 'none'");
        }
        // Verify comment exists
        const comment = await Comment_1.CommentModel.findById(id);
        if (!comment || comment.is_deleted) {
            return (0, errors_1.sendNotFound)(res, "Comment");
        }
        // Can't vote on your own comment
        if (comment.user_id === userId) {
            return (0, errors_1.sendValidationError)(res, "You cannot vote on your own comment");
        }
        // Handle "none" to remove vote
        if (vote === "none") {
            // Check if user has a vote to remove
            const existingVote = await db_1.pool.query("SELECT vote_type FROM comment_votes WHERE comment_id = $1 AND user_id = $2", [id, userId]);
            if (existingVote.rows.length > 0) {
                const oldVoteType = existingVote.rows[0].vote_type;
                const result = await Comment_1.CommentModel.vote(id, userId, oldVoteType); // Toggle off
                // Emit realtime comment update
                (0, websocket_1.emitCommentUpdate)({
                    comment_id: id,
                    market_id: comment.market_id,
                    parent_id: comment.parent_id,
                    event: "voted",
                    upvotes: result.upvotes,
                    downvotes: result.downvotes,
                    timestamp: new Date(),
                });
                return (0, errors_1.sendSuccess)(res, {
                    message: "Vote removed",
                    upvotes: result.upvotes,
                    downvotes: result.downvotes,
                });
            }
            else {
                // No vote to remove, just return current counts
                return (0, errors_1.sendSuccess)(res, {
                    message: "No vote to remove",
                    upvotes: comment.upvotes,
                    downvotes: comment.downvotes,
                });
            }
        }
        const result = await Comment_1.CommentModel.vote(id, userId, vote);
        // Emit realtime comment update
        (0, websocket_1.emitCommentUpdate)({
            comment_id: id,
            market_id: comment.market_id,
            parent_id: comment.parent_id,
            event: "voted",
            upvotes: result.upvotes,
            downvotes: result.downvotes,
            timestamp: new Date(),
        });
        return (0, errors_1.sendSuccess)(res, {
            message: "Vote recorded",
            upvotes: result.upvotes,
            downvotes: result.downvotes,
        });
    }
    catch (error) {
        console.error("Vote comment error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.voteComment = voteComment;
//# sourceMappingURL=controller_comment.js.map