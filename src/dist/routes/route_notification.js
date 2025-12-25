"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const routeHandler_1 = require("../types/routeHandler");
const controller_notification_1 = require("../controllers/controller_notification");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticateToken);
// @route GET /api/notifications - Get notifications
router.get("/", (0, routeHandler_1.typedHandler)(controller_notification_1.getNotifications));
// @route GET /api/notifications/unread-count - Get unread count
router.get("/unread-count", (0, routeHandler_1.typedHandler)(controller_notification_1.getUnreadCount));
// @route GET /api/notifications/preferences - Get preferences
router.get("/preferences", (0, routeHandler_1.typedHandler)(controller_notification_1.getPreferences));
// @route PUT /api/notifications/preferences - Update preferences
router.put("/preferences", (0, routeHandler_1.typedHandler)(controller_notification_1.updatePreferences));
// @route POST /api/notifications/read-all - Mark all as read
router.post("/read-all", (0, routeHandler_1.typedHandler)(controller_notification_1.markAllAsRead));
// @route POST /api/notifications/:id/read - Mark as read
router.post("/:id/read", (0, routeHandler_1.typedHandler)(controller_notification_1.markAsRead));
exports.default = router;
//# sourceMappingURL=route_notification.js.map