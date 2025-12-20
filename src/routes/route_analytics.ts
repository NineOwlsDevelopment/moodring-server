import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { typedHandler } from "../types/routeHandler";
import {
  getPlatformStats,
  getPlatformStatsHistory,
  getVolumeLeaderboard,
  getProfitLeaderboard,
  getCreatorsLeaderboard,
  getUserStats,
  getMyStats,
  getMarketAnalytics,
  healthCheck,
} from "../controllers/controller_analytics";

const router = Router();

// Public routes
router.get("/platform", getPlatformStats);
router.get("/leaderboard/volume", getVolumeLeaderboard);
router.get("/leaderboard/profit", getProfitLeaderboard);
router.get("/leaderboard/creators", getCreatorsLeaderboard);
router.get("/user/:userId", getUserStats);
router.get("/market/:id", getMarketAnalytics);

// Protected routes
router.get("/my-stats", authenticateToken, typedHandler(getMyStats));

// Admin routes
router.get(
  "/platform/history",
  authenticateToken as any,
  requireAdmin as any,
  typedHandler(getPlatformStatsHistory)
);

export default router;
