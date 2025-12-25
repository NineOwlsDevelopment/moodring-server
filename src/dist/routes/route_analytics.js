"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const admin_1 = require("../middleware/admin");
const routeHandler_1 = require("../types/routeHandler");
const controller_analytics_1 = require("../controllers/controller_analytics");
const router = (0, express_1.Router)();
// Public routes
router.get("/platform", controller_analytics_1.getPlatformStats);
router.get("/leaderboard/volume", controller_analytics_1.getVolumeLeaderboard);
router.get("/leaderboard/profit", controller_analytics_1.getProfitLeaderboard);
router.get("/leaderboard/creators", controller_analytics_1.getCreatorsLeaderboard);
router.get("/user/:userId", controller_analytics_1.getUserStats);
router.get("/market/:id", controller_analytics_1.getMarketAnalytics);
// Protected routes
router.get("/my-stats", auth_1.authenticateToken, (0, routeHandler_1.typedHandler)(controller_analytics_1.getMyStats));
// Admin routes
router.get("/platform/history", auth_1.authenticateToken, admin_1.requireAdmin, (0, routeHandler_1.typedHandler)(controller_analytics_1.getPlatformStatsHistory));
exports.default = router;
//# sourceMappingURL=route_analytics.js.map