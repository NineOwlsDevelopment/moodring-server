"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyActivity = exports.getActivitiesByType = exports.getMarketActivity = exports.getUserActivity = exports.getActivityFeed = void 0;
const Activity_1 = require("../models/Activity");
const errors_1 = require("../utils/errors");
const validation_1 = require("../utils/validation");
/**
 * @route GET /api/activity/feed
 * @desc Get public activity feed
 * @access Public
 */
const getActivityFeed = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        const activities = await Activity_1.ActivityModel.getPublicFeed(limit, offset);
        return (0, errors_1.sendSuccess)(res, {
            activities,
            pagination: {
                page,
                limit,
                hasMore: activities.length === limit,
            },
        });
    }
    catch (error) {
        console.error("Get activity feed error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getActivityFeed = getActivityFeed;
/**
 * @route GET /api/activity/user/:userId
 * @desc Get a user's public activity
 * @access Public
 */
const getUserActivity = async (req, res) => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        const activities = await Activity_1.ActivityModel.getUserActivity(userId, limit, offset);
        console.log(activities);
        return (0, errors_1.sendSuccess)(res, {
            activities,
            pagination: {
                page,
                limit,
                hasMore: activities.length === limit,
            },
        });
    }
    catch (error) {
        console.error("Get user activity error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getUserActivity = getUserActivity;
/**
 * @route GET /api/activity/market/:id
 * @desc Get activity for a specific market
 * @access Public
 */
const getMarketActivity = async (req, res) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        const activities = await Activity_1.ActivityModel.getMarketActivity(id, limit, offset);
        return (0, errors_1.sendSuccess)(res, {
            activities,
            pagination: {
                page,
                limit,
                hasMore: activities.length === limit,
            },
        });
    }
    catch (error) {
        console.error("Get market activity error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getMarketActivity = getMarketActivity;
/**
 * @route GET /api/activity/type/:type
 * @desc Get activities by type
 * @access Public
 */
const getActivitiesByType = async (req, res) => {
    try {
        const { type } = req.params;
        const validTypes = [
            "trade",
            "market_created",
            "market_resolved",
            "liquidity_added",
            "liquidity_removed",
            "comment",
            "user_joined",
            "deposit",
            "withdrawal",
            "claim",
            "lp_rewards_claimed",
        ];
        const typeValidation = (0, validation_1.validateEnum)(type, "Activity type", validTypes);
        if (!typeValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, typeValidation.error);
        }
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        const activities = await Activity_1.ActivityModel.getByType(type, limit, offset);
        return (0, errors_1.sendSuccess)(res, {
            activities,
            pagination: {
                page,
                limit,
                hasMore: activities.length === limit,
            },
        });
    }
    catch (error) {
        console.error("Get activities by type error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getActivitiesByType = getActivitiesByType;
/**
 * @route GET /api/activity/my
 * @desc Get authenticated user's activity
 * @access Private
 */
const getMyActivity = async (req, res) => {
    try {
        const userId = req.id;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        const type = req.query.type;
        // Validate type if provided
        if (type) {
            const validTypes = [
                "trade",
                "market_created",
                "market_resolved",
                "liquidity_added",
                "liquidity_removed",
                "comment",
                "user_joined",
                "deposit",
                "withdrawal",
                "claim",
                "lp_rewards_claimed",
            ];
            if (!validTypes.includes(type)) {
                return (0, errors_1.sendValidationError)(res, `Invalid activity type: ${type}`);
            }
        }
        const activities = await Activity_1.ActivityModel.getUserActivity(userId, limit, offset, type);
        // console share claim activity
        for (const activity of activities) {
            if (activity.activity_type === "claim") {
                console.log("claim activity", activity);
            }
        }
        return (0, errors_1.sendSuccess)(res, {
            activities,
            pagination: {
                page,
                limit,
                hasMore: activities.length === limit,
            },
        });
    }
    catch (error) {
        console.error("Get my activity error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getMyActivity = getMyActivity;
//# sourceMappingURL=controller_activity.js.map