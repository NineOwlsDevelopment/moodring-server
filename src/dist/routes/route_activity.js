"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const routeHandler_1 = require("../types/routeHandler");
const controller_activity_1 = require("../controllers/controller_activity");
const router = (0, express_1.Router)();
// @route GET /api/activity/feed - Get public activity feed
router.get("/feed", controller_activity_1.getActivityFeed);
// @route GET /api/activity/my - Get authenticated user's activity
router.get("/my", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_activity_1.getMyActivity));
// @route GET /api/activity/user/:userId - Get a user's public activity
router.get("/user/:userId", controller_activity_1.getUserActivity);
// @route GET /api/activity/market/:id - Get market activity
router.get("/market/:id", controller_activity_1.getMarketActivity);
// @route GET /api/activity/type/:type - Get activities by type
router.get("/type/:type", controller_activity_1.getActivitiesByType);
exports.default = router;
//# sourceMappingURL=route_activity.js.map