import { Response } from "express";
import { ActivityModel, ActivityType } from "../models/Activity";
import { sendError, sendSuccess, sendValidationError } from "../utils/errors";
import { validateEnum } from "../utils/validation";
import {
  GetActivityFeedRequest,
  GetUserActivityRequest,
  GetMarketActivityRequest,
  GetActivitiesByTypeRequest,
  GetMyActivityRequest,
} from "../types/requests";

/**
 * @route GET /api/activity/feed
 * @desc Get public activity feed
 * @access Public
 */
export const getActivityFeed = async (
  req: GetActivityFeedRequest,
  res: Response
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = (page - 1) * limit;

    const activities = await ActivityModel.getPublicFeed(limit, offset);

    return sendSuccess(res, {
      activities,
      pagination: {
        page,
        limit,
        hasMore: activities.length === limit,
      },
    });
  } catch (error: any) {
    console.error("Get activity feed error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/activity/user/:userId
 * @desc Get a user's public activity
 * @access Public
 */
export const getUserActivity = async (
  req: GetUserActivityRequest,
  res: Response
) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = (page - 1) * limit;

    const activities = await ActivityModel.getUserActivity(
      userId,
      limit,
      offset
    );

    console.log(activities);

    return sendSuccess(res, {
      activities,
      pagination: {
        page,
        limit,
        hasMore: activities.length === limit,
      },
    });
  } catch (error: any) {
    console.error("Get user activity error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/activity/market/:id
 * @desc Get activity for a specific market
 * @access Public
 */
export const getMarketActivity = async (
  req: GetMarketActivityRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = (page - 1) * limit;

    const activities = await ActivityModel.getMarketActivity(id, limit, offset);

    return sendSuccess(res, {
      activities,
      pagination: {
        page,
        limit,
        hasMore: activities.length === limit,
      },
    });
  } catch (error: any) {
    console.error("Get market activity error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/activity/type/:type
 * @desc Get activities by type
 * @access Public
 */
export const getActivitiesByType = async (
  req: GetActivitiesByTypeRequest,
  res: Response
) => {
  try {
    const { type } = req.params;
    const validTypes: ActivityType[] = [
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

    const typeValidation = validateEnum(type, "Activity type", validTypes);
    if (!typeValidation.isValid) {
      return sendValidationError(res, typeValidation.error!);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = (page - 1) * limit;

    const activities = await ActivityModel.getByType(
      type as ActivityType,
      limit,
      offset
    );

    return sendSuccess(res, {
      activities,
      pagination: {
        page,
        limit,
        hasMore: activities.length === limit,
      },
    });
  } catch (error: any) {
    console.error("Get activities by type error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/activity/my
 * @desc Get authenticated user's activity
 * @access Private
 */
export const getMyActivity = async (
  req: GetMyActivityRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = (page - 1) * limit;
    const type = req.query.type as ActivityType | undefined;

    // Validate type if provided
    if (type) {
      const validTypes: ActivityType[] = [
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
        return sendValidationError(res, `Invalid activity type: ${type}`);
      }
    }

    // Include trades for user's own activity
    const activities = await ActivityModel.getUserActivity(
      userId,
      limit,
      offset,
      type,
      true // includeTrades = true for user's own activity
    );

    // console share claim activity
    for (const activity of activities) {
      if (activity.activity_type === "claim") {
        console.log("claim activity", activity);
      }
    }

    return sendSuccess(res, {
      activities,
      pagination: {
        page,
        limit,
        hasMore: activities.length === limit,
      },
    });
  } catch (error: any) {
    console.error("Get my activity error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};
