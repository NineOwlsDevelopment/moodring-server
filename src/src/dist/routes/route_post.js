"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const routeHandler_1 = require("../types/routeHandler");
const controller_post_1 = require("../controllers/controller_post");
const rateLimit_1 = require("../middleware/rateLimit");
const router = express_1.default.Router();
// Create a new post (with optional image/video upload)
router.post("/", auth_1.authenticateToken, rateLimit_1.commentLimiter, // Use comment limiter for rate limiting
controller_post_1.upload.single("media"), // Accept single file with field name "media"
(0, routeHandler_1.typedHandler)(controller_post_1.createPost));
// Create a comment on a post (must come before /:id routes to avoid conflicts)
router.post("/comments", auth_1.authenticateToken, rateLimit_1.commentLimiter, (0, routeHandler_1.typedHandler)(controller_post_1.createPostComment));
// Get replies to a comment (must come before /:id routes)
router.get("/comments/:id/replies", auth_1.optionalAuth, (0, routeHandler_1.typedHandler)(controller_post_1.getCommentReplies));
// Like/unlike a post comment (must come before /:id routes)
router.post("/comments/:id/like", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_post_1.togglePostCommentLike));
// Like/unlike a post
router.post("/:id/like", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_post_1.togglePostLike));
// Get comments for a post
router.get("/:id/comments", auth_1.optionalAuth, (0, routeHandler_1.typedHandler)(controller_post_1.getPostComments));
exports.default = router;
//# sourceMappingURL=route_post.js.map