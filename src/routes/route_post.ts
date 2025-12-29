import express from "express";
import { authenticateToken, optionalAuth } from "../middleware/auth";
import { typedHandler } from "../types/routeHandler";
import {
  createPost,
  togglePostLike,
  getPostComments,
  getCommentReplies,
  createPostComment,
  togglePostCommentLike,
  upload,
} from "../controllers/controller_post";
import { commentLimiter } from "../middleware/rateLimit";

const router = express.Router();

// Create a new post (with optional image/video upload)
router.post(
  "/",
  authenticateToken,
  commentLimiter, // Use comment limiter for rate limiting
  upload.single("media"), // Accept single file with field name "media"
  typedHandler(createPost)
);

// Create a comment on a post (must come before /:id routes to avoid conflicts)
router.post(
  "/comments",
  authenticateToken,
  commentLimiter,
  typedHandler(createPostComment)
);

// Get replies to a comment (must come before /:id routes)
router.get(
  "/comments/:id/replies",
  optionalAuth,
  typedHandler(getCommentReplies)
);

// Like/unlike a post comment (must come before /:id routes)
router.post(
  "/comments/:id/like",
  authenticateToken,
  typedHandler(togglePostCommentLike)
);

// Like/unlike a post
router.post(
  "/:id/like",
  authenticateToken,
  typedHandler(togglePostLike)
);

// Get comments for a post
router.get(
  "/:id/comments",
  optionalAuth,
  typedHandler(getPostComments)
);

export default router;

