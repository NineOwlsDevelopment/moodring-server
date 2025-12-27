"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePreferences = exports.getPreferences = exports.markAllAsRead = exports.markAsRead = exports.getUnreadCount = exports.getNotifications = void 0;
const Notification_1 = require("../models/Notification");
const db_1 = require("../db");
const errors_1 = require("../utils/errors");
const json_1 = require("../utils/json");
/**
 * @route GET /api/notifications
 * @desc Get user's notifications
 * @access Private
 */
const getNotifications = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        const unreadOnly = req.query.unread === "true";
        const { notifications, total, unreadCount } = await Notification_1.NotificationModel.findByUserId(userId, limit, offset, unreadOnly);
        const totalPages = Math.ceil(total / limit);
        return (0, errors_1.sendSuccess)(res, {
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
    }
    catch (error) {
        console.error("Get notifications error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getNotifications = getNotifications;
/**
 * @route GET /api/notifications/unread-count
 * @desc Get unread notification count
 * @access Private
 */
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const count = await Notification_1.NotificationModel.getUnreadCount(userId);
        return (0, errors_1.sendSuccess)(res, { unread_count: count });
    }
    catch (error) {
        console.error("Get unread count error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getUnreadCount = getUnreadCount;
/**
 * @route POST /api/notifications/:id/read
 * @desc Mark a notification as read
 * @access Private
 */
const markAsRead = async (req, res) => {
    try {
        const userId = req.id;
        const { id } = req.params;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const success = await Notification_1.NotificationModel.markAsRead(id, userId);
        if (!success) {
            return (0, errors_1.sendNotFound)(res, "Notification");
        }
        return (0, errors_1.sendSuccess)(res, { message: "Notification marked as read" });
    }
    catch (error) {
        console.error("Mark as read error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.markAsRead = markAsRead;
/**
 * @route POST /api/notifications/read-all
 * @desc Mark all notifications as read
 * @access Private
 */
const markAllAsRead = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const count = await Notification_1.NotificationModel.markAllAsRead(userId);
        return (0, errors_1.sendSuccess)(res, {
            message: "All notifications marked as read",
            count,
        });
    }
    catch (error) {
        console.error("Mark all as read error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.markAllAsRead = markAllAsRead;
/**
 * @route GET /api/notifications/preferences
 * @desc Get notification preferences
 * @access Private
 */
const getPreferences = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const result = await db_1.pool.query("SELECT notification_preferences FROM users WHERE id = $1", [userId]);
        if (result.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "User");
        }
        return (0, errors_1.sendSuccess)(res, {
            preferences: result.rows[0].notification_preferences || {
                email_market_resolved: true,
                email_market_expiring: true,
                email_trade_executed: false,
                email_comment_reply: true,
                push_enabled: true,
            },
        });
    }
    catch (error) {
        console.error("Get preferences error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getPreferences = getPreferences;
/**
 * @route PUT /api/notifications/preferences
 * @desc Update notification preferences
 * @access Private
 */
const updatePreferences = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
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
        const filteredPreferences = {};
        for (const key of validKeys) {
            if (typeof preferences[key] === "boolean") {
                filteredPreferences[key] = preferences[key];
            }
        }
        const result = await db_1.pool.query(`
      UPDATE users
      SET notification_preferences = notification_preferences || $1::jsonb,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $2
      RETURNING notification_preferences
    `, [(0, json_1.prepareJsonb)(filteredPreferences), userId]);
        if (result.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "User");
        }
        return (0, errors_1.sendSuccess)(res, {
            message: "Preferences updated",
            preferences: result.rows[0].notification_preferences,
        });
    }
    catch (error) {
        console.error("Update preferences error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.updatePreferences = updatePreferences;
//# sourceMappingURL=controller_notification.js.map