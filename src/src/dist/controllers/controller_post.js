"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.togglePostCommentLike = exports.createPostComment = exports.getCommentReplies = exports.getPostComments = exports.togglePostLike = exports.createPost = exports.upload = void 0;
const Post_1 = require("../models/Post");
const errors_1 = require("../utils/errors");
const validation_1 = require("../utils/validation");
const contentModeration_1 = require("../utils/contentModeration");
const contentModeration_2 = require("../utils/contentModeration");
const metadata_1 = require("../utils/metadata");
const multer_1 = __importDefault(require("multer"));
// Configure multer for file uploads
const storage = multer_1.default.memoryStorage();
exports.upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max file size
    },
    fileFilter: (req, file, cb) => {
        // Allow images and videos
        if (file.mimetype.startsWith("image/") ||
            file.mimetype.startsWith("video/")) {
            cb(null, true);
        }
        else {
            cb(new Error("Only images and videos are allowed"));
        }
    },
});
const createPost = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { content, market_id } = req.body;
        // Validate content
        const contentValidation = (0, validation_1.validateRequired)(content, "Content");
        if (!contentValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, contentValidation.error);
        }
        const lengthValidation = (0, validation_1.validateLength)(content, "Content", 1, 5000);
        if (!lengthValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, lengthValidation.error);
        }
        // Validate text content for banned words
        const textValidation = (0, contentModeration_1.validateTextContent)(content, "Post content");
        if (!textValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, textValidation.error || "Invalid content");
        }
        let imageUrl = null;
        let videoUrl = null;
        // Handle file upload (image or video)
        if (req.file) {
            const isImage = req.file.mimetype.startsWith("image/");
            const isVideo = req.file.mimetype.startsWith("video/");
            if (!isImage && !isVideo) {
                return (0, errors_1.sendValidationError)(res, "File must be an image or video");
            }
            // Validate image if it's an image
            if (isImage) {
                const imageValidation = await (0, contentModeration_2.validateImage)(req.file.buffer, req.file.mimetype);
                if (!imageValidation.isValid) {
                    return (0, errors_1.sendValidationError)(res, imageValidation.error || "Invalid image");
                }
            }
            // Upload to S3
            if (!process.env.S3_BUCKET) {
                return (0, errors_1.sendError)(res, 500, "Storage not configured");
            }
            try {
                if (isImage) {
                    imageUrl = await (0, metadata_1.uploadImageToS3)(req.file.buffer, req.file.originalname, req.file.mimetype, process.env.S3_BUCKET);
                }
                else if (isVideo) {
                    videoUrl = await (0, metadata_1.uploadVideoToS3)(req.file.buffer, req.file.originalname, req.file.mimetype, process.env.S3_BUCKET);
                }
            }
            catch (error) {
                console.error("Failed to upload file to S3:", error);
                return (0, errors_1.sendError)(res, 500, "Failed to upload file");
            }
        }
        // Create post
        const post = await Post_1.PostModel.create({
            user_id: userId,
            content: content.trim(),
            image_url: imageUrl,
            video_url: videoUrl,
            market_id: market_id,
        });
        return (0, errors_1.sendSuccess)(res, { post });
    }
    catch (error) {
        console.error("Create post error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to create post. Please try again.");
    }
};
exports.createPost = createPost;
/**
 * @route POST /api/posts/:id/like
 * @desc Like or unlike a post
 * @access Private
 */
const togglePostLike = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { id: postId } = req.params;
        const result = await Post_1.PostModel.toggleLike(postId, userId);
        return (0, errors_1.sendSuccess)(res, result);
    }
    catch (error) {
        console.error("Toggle post like error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to toggle like");
    }
};
exports.togglePostLike = togglePostLike;
/**
 * @route GET /api/posts/:id/comments
 * @desc Get comments for a post
 * @access Public (optional auth)
 */
const getPostComments = async (req, res) => {
    try {
        const { id: postId } = req.params;
        const currentUserId = req.id || undefined;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const comments = await Post_1.PostCommentModel.getByPost(postId, currentUserId, limit, offset);
        return (0, errors_1.sendSuccess)(res, { comments });
    }
    catch (error) {
        console.error("Get post comments error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to get comments");
    }
};
exports.getPostComments = getPostComments;
/**
 * @route GET /api/posts/comments/:id/replies
 * @desc Get replies to a comment
 * @access Public (optional auth)
 */
const getCommentReplies = async (req, res) => {
    try {
        const { id: commentId } = req.params;
        const currentUserId = req.id || undefined;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const replies = await Post_1.PostCommentModel.getReplies(commentId, currentUserId, limit, offset);
        return (0, errors_1.sendSuccess)(res, { replies });
    }
    catch (error) {
        console.error("Get comment replies error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to get replies");
    }
};
exports.getCommentReplies = getCommentReplies;
/**
 * @route POST /api/posts/comments
 * @desc Create a comment on a post
 * @access Private
 */
const createPostComment = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { post_id, content, parent_comment_id } = req.body;
        // Validate content
        const contentValidation = (0, validation_1.validateRequired)(content, "Content");
        if (!contentValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, contentValidation.error);
        }
        const lengthValidation = (0, validation_1.validateLength)(content, "Content", 1, 5000);
        if (!lengthValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, lengthValidation.error);
        }
        // Validate text content for banned words
        const textValidation = (0, contentModeration_1.validateTextContent)(content, "Comment content");
        if (!textValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, textValidation.error || "Invalid content");
        }
        const comment = await Post_1.PostCommentModel.create({
            post_id: post_id,
            user_id: userId,
            content: content.trim(),
            parent_comment_id: parent_comment_id,
        });
        // Get comment with user info
        const comments = await Post_1.PostCommentModel.getByPost(post_id, userId, 1, 0);
        const commentWithUser = comments.find((c) => c.id === comment.id);
        return (0, errors_1.sendSuccess)(res, {
            comment: commentWithUser || comment,
        });
    }
    catch (error) {
        console.error("Create post comment error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to create comment");
    }
};
exports.createPostComment = createPostComment;
/**
 * @route POST /api/posts/comments/:id/like
 * @desc Like or unlike a post comment
 * @access Private
 */
const togglePostCommentLike = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { id: commentId } = req.params;
        const result = await Post_1.PostCommentModel.toggleLike(commentId, userId);
        return (0, errors_1.sendSuccess)(res, result);
    }
    catch (error) {
        console.error("Toggle post comment like error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to toggle like");
    }
};
exports.togglePostCommentLike = togglePostCommentLike;
//# sourceMappingURL=controller_post.js.map