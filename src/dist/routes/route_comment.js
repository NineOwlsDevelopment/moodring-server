"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const validate_1 = require("../middleware/validate");
const routeHandler_1 = require("../types/routeHandler");
const controller_comment_1 = require("../controllers/controller_comment");
const router = (0, express_1.Router)();
// @route POST /api/comments - Create a comment
router.post("/", auth_1.authenticateToken, rateLimit_1.commentLimiter, (0, routeHandler_1.typedHandler)(controller_comment_1.createComment));
// @route GET /api/comments/market/:id - Get market comments
router.get("/market/:id", auth_1.optionalAuth, (0, validate_1.validateUUID)("id"), (0, routeHandler_1.typedHandler)(controller_comment_1.getMarketComments));
// @route GET /api/comments/:id/replies - Get comment replies
router.get("/:id/replies", auth_1.optionalAuth, (0, validate_1.validateUUID)("id"), (0, routeHandler_1.typedHandler)(controller_comment_1.getCommentReplies));
// @route PUT /api/comments/:id - Update a comment
router.put("/:id", auth_1.authenticateToken, (0, validate_1.validateUUID)("id"), (0, routeHandler_1.typedHandler)(controller_comment_1.updateComment));
// @route DELETE /api/comments/:id - Delete a comment
router.delete("/:id", auth_1.authenticateToken, (0, validate_1.validateUUID)("id"), (0, routeHandler_1.typedHandler)(controller_comment_1.deleteComment));
// @route POST /api/comments/:id/vote - Vote on a comment
router.post("/:id/vote", auth_1.authenticateToken, (0, validate_1.validateUUID)("id"), rateLimit_1.voteLimiter, (0, routeHandler_1.typedHandler)(controller_comment_1.voteComment));
exports.default = router;
//# sourceMappingURL=route_comment.js.map