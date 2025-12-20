import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { typedHandler } from "../types/routeHandler";
import {
  getActivityFeed,
  getUserActivity,
  getMarketActivity,
  getActivitiesByType,
  getMyActivity,
} from "../controllers/controller_activity";

const router = Router();

// @route GET /api/activity/feed - Get public activity feed
router.get("/feed", getActivityFeed);

// @route GET /api/activity/my - Get authenticated user's activity
router.get("/my", authenticateToken, typedHandler(getMyActivity));

// @route GET /api/activity/user/:userId - Get a user's public activity
router.get("/user/:userId", getUserActivity);

// @route GET /api/activity/market/:id - Get market activity
router.get("/market/:id", getMarketActivity);

// @route GET /api/activity/type/:type - Get activities by type
router.get("/type/:type", getActivitiesByType);

export default router;
