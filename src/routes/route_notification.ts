import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { typedHandler } from "../types/routeHandler";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getPreferences,
  updatePreferences,
} from "../controllers/controller_notification";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// @route GET /api/notifications - Get notifications
router.get("/", typedHandler(getNotifications));

// @route GET /api/notifications/unread-count - Get unread count
router.get("/unread-count", typedHandler(getUnreadCount));

// @route GET /api/notifications/preferences - Get preferences
router.get("/preferences", typedHandler(getPreferences));

// @route PUT /api/notifications/preferences - Update preferences
router.put("/preferences", typedHandler(updatePreferences));

// @route POST /api/notifications/read-all - Mark all as read
router.post("/read-all", typedHandler(markAllAsRead));

// @route POST /api/notifications/:id/read - Mark as read
router.post("/:id/read", typedHandler(markAsRead));

export default router;
