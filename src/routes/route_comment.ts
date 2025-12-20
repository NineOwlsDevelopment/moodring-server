import { Router } from "express";
import { authenticateToken, optionalAuth } from "../middleware/auth";
import { commentLimiter, voteLimiter } from "../middleware/rateLimit";
import { validateUUID } from "../middleware/validate";
import { typedHandler } from "../types/routeHandler";
import {
  createComment,
  getMarketComments,
  getCommentReplies,
  updateComment,
  deleteComment,
  voteComment,
} from "../controllers/controller_comment";

const router = Router();

// @route POST /api/comments - Create a comment
router.post(
  "/",
  authenticateToken,
  commentLimiter,
  typedHandler(createComment)
);

// @route GET /api/comments/market/:id - Get market comments
router.get(
  "/market/:id",
  optionalAuth,
  validateUUID("id"),
  typedHandler(getMarketComments)
);

// @route GET /api/comments/:id/replies - Get comment replies
router.get(
  "/:id/replies",
  optionalAuth,
  validateUUID("id"),
  typedHandler(getCommentReplies)
);

// @route PUT /api/comments/:id - Update a comment
router.put(
  "/:id",
  authenticateToken,
  validateUUID("id"),
  typedHandler(updateComment)
);

// @route DELETE /api/comments/:id - Delete a comment
router.delete(
  "/:id",
  authenticateToken,
  validateUUID("id"),
  typedHandler(deleteComment)
);

// @route POST /api/comments/:id/vote - Vote on a comment
router.post(
  "/:id/vote",
  authenticateToken,
  validateUUID("id"),
  voteLimiter,
  typedHandler(voteComment)
);

export default router;
