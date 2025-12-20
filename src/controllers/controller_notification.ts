import { Response } from "express";
import { NotificationModel } from "../models/Notification";
import { pool } from "../db";
import { sendError, sendNotFound, sendSuccess } from "../utils/errors";
import { prepareJsonb } from "../utils/json";
import {
  GetNotificationsRequest,
  GetUnreadCountRequest,
  MarkAsReadRequest,
  MarkAllAsReadRequest,
  GetPreferencesRequest,
  UpdatePreferencesRequest,
} from "../types/requests";

/**
 * @route GET /api/notifications
 * @desc Get user's notifications
 * @access Private
 */
export const getNotifications = async (
  req: GetNotificationsRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = (page - 1) * limit;
    const unreadOnly = req.query.unread === "true";

    const { notifications, total, unreadCount } =
      await NotificationModel.findByUserId(userId, limit, offset, unreadOnly);

    const totalPages = Math.ceil(total / limit);

    return sendSuccess(res, {
      notifications,
      unread_count: unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error: any) {
    console.error("Get notifications error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/notifications/unread-count
 * @desc Get unread notification count
 * @access Private
 */
export const getUnreadCount = async (
  req: GetUnreadCountRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    const count = await NotificationModel.getUnreadCount(userId);

    return sendSuccess(res, { unread_count: count });
  } catch (error: any) {
    console.error("Get unread count error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route POST /api/notifications/:id/read
 * @desc Mark a notification as read
 * @access Private
 */
export const markAsRead = async (req: MarkAsReadRequest, res: Response) => {
  try {
    const userId = req.id;
    const { id } = req.params;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    const success = await NotificationModel.markAsRead(id, userId);

    if (!success) {
      return sendNotFound(res, "Notification");
    }

    return sendSuccess(res, { message: "Notification marked as read" });
  } catch (error: any) {
    console.error("Mark as read error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route POST /api/notifications/read-all
 * @desc Mark all notifications as read
 * @access Private
 */
export const markAllAsRead = async (
  req: MarkAllAsReadRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    const count = await NotificationModel.markAllAsRead(userId);

    return sendSuccess(res, {
      message: "All notifications marked as read",
      count,
    });
  } catch (error: any) {
    console.error("Mark all as read error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/notifications/preferences
 * @desc Get notification preferences
 * @access Private
 */
export const getPreferences = async (
  req: GetPreferencesRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    const result = await pool.query(
      "SELECT notification_preferences FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return sendNotFound(res, "User");
    }

    return sendSuccess(res, {
      preferences: result.rows[0].notification_preferences || {
        email_market_resolved: true,
        email_market_expiring: true,
        email_trade_executed: false,
        email_comment_reply: true,
        push_enabled: true,
      },
    });
  } catch (error: any) {
    console.error("Get preferences error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route PUT /api/notifications/preferences
 * @desc Update notification preferences
 * @access Private
 */
export const updatePreferences = async (
  req: UpdatePreferencesRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    const preferences = req.body;

    // Validate preferences object
    const validKeys = [
      "email_market_resolved",
      "email_market_expiring",
      "email_trade_executed",
      "email_comment_reply",
      "push_enabled",
    ];

    const filteredPreferences: Record<string, boolean> = {};
    for (const key of validKeys) {
      if (typeof (preferences as Record<string, any>)[key] === "boolean") {
        filteredPreferences[key] = (preferences as Record<string, any>)[key];
      }
    }

    const result = await pool.query(
      `
      UPDATE users
      SET notification_preferences = notification_preferences || $1::jsonb,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $2
      RETURNING notification_preferences
    `,
      [prepareJsonb(filteredPreferences), userId]
    );

    if (result.rows.length === 0) {
      return sendNotFound(res, "User");
    }

    return sendSuccess(res, {
      message: "Preferences updated",
      preferences: result.rows[0].notification_preferences,
    });
  } catch (error: any) {
    console.error("Update preferences error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};
