import { Response } from "express";
import { PlatformStatsModel, CreatorStatsModel } from "../models/PlatformStats";
import { UserStatsModel } from "../models/UserStats";
import { pool } from "../db";
import { sendError, sendNotFound, sendSuccess } from "../utils/errors";
import {
  GetPlatformStatsRequest,
  GetPlatformStatsHistoryRequest,
  GetVolumeLeaderboardRequest,
  GetProfitLeaderboardRequest,
  GetCreatorsLeaderboardRequest,
  GetUserStatsRequest,
  GetMyStatsRequest,
  GetMarketAnalyticsRequest,
  HealthCheckRequest,
} from "../types/requests";

/**
 * @route GET /api/analytics/platform
 * @desc Get platform-wide statistics
 * @access Public
 */
export const getPlatformStats = async (
  req: GetPlatformStatsRequest,
  res: Response
) => {
  try {
    const aggregateStats = await PlatformStatsModel.getAggregateStats();

    return sendSuccess(res, {
      stats: aggregateStats,
    });
  } catch (error: any) {
    console.error("Get platform stats error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/analytics/platform/history
 * @desc Get historical platform statistics
 * @access Admin
 */
export const getPlatformStatsHistory = async (
  req: GetPlatformStatsHistoryRequest,
  res: Response
) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const stats = await PlatformStatsModel.getHistoricalStats(days);

    return sendSuccess(res, {
      stats,
      period_days: days,
    });
  } catch (error: any) {
    console.error("Get platform stats history error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/analytics/leaderboard/volume
 * @desc Get leaderboard by trading volume
 * @access Public
 */
export const getVolumeLeaderboard = async (
  req: GetVolumeLeaderboardRequest,
  res: Response
) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 100);
    const leaderboard = await UserStatsModel.getLeaderboardByVolume(limit);

    return sendSuccess(res, {
      leaderboard,
      metric: "volume",
    });
  } catch (error: any) {
    console.error("Get volume leaderboard error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/analytics/leaderboard/profit
 * @desc Get leaderboard by profit
 * @access Public
 */
export const getProfitLeaderboard = async (
  req: GetProfitLeaderboardRequest,
  res: Response
) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 100);
    const leaderboard = await UserStatsModel.getLeaderboardByProfit(limit);

    return sendSuccess(res, {
      leaderboard,
      metric: "profit",
    });
  } catch (error: any) {
    console.error("Get profit leaderboard error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/analytics/leaderboard/creators
 * @desc Get top market creators
 * @access Public
 */
export const getCreatorsLeaderboard = async (
  req: GetCreatorsLeaderboardRequest,
  res: Response
) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const creators = await CreatorStatsModel.getTopCreators(limit);

    return sendSuccess(res, {
      creators,
    });
  } catch (error: any) {
    console.error("Get creators leaderboard error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/analytics/user/:userId
 * @desc Get public stats for a user
 * @access Public
 */
export const getUserStats = async (req: GetUserStatsRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const [userStats, creatorStats, volumeRank, profitRank] = await Promise.all(
      [
        UserStatsModel.findByUserId(userId),
        CreatorStatsModel.findByUserId(userId),
        UserStatsModel.getUserRank(userId, "volume"),
        UserStatsModel.getUserRank(userId, "profit"),
      ]
    );

    if (!userStats && !creatorStats) {
      return sendNotFound(res, "User stats");
    }

    return sendSuccess(res, {
      trading: userStats
        ? {
            total_trades: userStats.total_trades,
            total_volume: userStats.total_volume,
            winning_trades: userStats.winning_trades,
            losing_trades: userStats.losing_trades,
            win_rate:
              userStats.total_trades > 0
                ? (
                    (userStats.winning_trades / userStats.total_trades) *
                    100
                  ).toFixed(2)
                : 0,
            total_profit_loss: userStats.total_profit_loss,
            current_streak: userStats.current_streak,
            longest_streak: userStats.longest_streak,
          }
        : null,
      creating: creatorStats
        ? {
            markets_created: creatorStats.markets_created,
            total_volume_generated: creatorStats.total_volume_generated,
            total_fees_earned: creatorStats.total_fees_earned,
            reputation_score: creatorStats.reputation_score,
          }
        : null,
      ranks: {
        volume: volumeRank,
        profit: profitRank,
      },
    });
  } catch (error: any) {
    console.error("Get user stats error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/analytics/my-stats
 * @desc Get authenticated user's detailed stats
 * @access Private
 */
export const getMyStats = async (req: GetMyStatsRequest, res: Response) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    const [userStats, creatorStats, volumeRank, profitRank] = await Promise.all(
      [
        UserStatsModel.getOrCreate(userId),
        CreatorStatsModel.findByUserId(userId),
        UserStatsModel.getUserRank(userId, "volume"),
        UserStatsModel.getUserRank(userId, "profit"),
      ]
    );

    return sendSuccess(res, {
      trading: {
        total_trades: userStats.total_trades,
        total_volume: userStats.total_volume,
        winning_trades: userStats.winning_trades,
        losing_trades: userStats.losing_trades,
        win_rate:
          userStats.total_trades > 0
            ? (
                (userStats.winning_trades / userStats.total_trades) *
                100
              ).toFixed(2)
            : "0",
        total_profit_loss: userStats.total_profit_loss,
        total_fees_paid: userStats.total_fees_paid,
        markets_participated: userStats.markets_participated,
        liquidity_provided: userStats.liquidity_provided,
        current_streak: userStats.current_streak,
        longest_streak: userStats.longest_streak,
        last_trade_at: userStats.last_trade_at,
      },
      creating: creatorStats
        ? {
            markets_created: creatorStats.markets_created,
            total_volume_generated: creatorStats.total_volume_generated,
            total_fees_earned: creatorStats.total_fees_earned,
            average_market_volume: creatorStats.average_market_volume,
            markets_resolved: creatorStats.markets_resolved,
            reputation_score: creatorStats.reputation_score,
          }
        : null,
      referrals: {
        count: userStats.referrals_count,
        earnings: userStats.referral_earnings,
      },
      ranks: {
        volume: volumeRank,
        profit: profitRank,
      },
    });
  } catch (error: any) {
    console.error("Get my stats error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/analytics/market/:id
 * @desc Get analytics for a specific market
 * @access Public
 */
export const getMarketAnalytics = async (
  req: GetMarketAnalyticsRequest,
  res: Response
) => {
  try {
    const { id } = req.params;

    const [marketResult, tradesResult, volumeResult] = await Promise.all([
      pool.query("SELECT * FROM markets WHERE id = $1", [id]),
      pool.query(
        `
        SELECT 
          COUNT(*)::int as total_trades,
          COUNT(DISTINCT user_id)::int as unique_traders,
          COUNT(*) FILTER (WHERE trade_type = 'buy')::int as buys,
          COUNT(*) FILTER (WHERE trade_type = 'sell')::int as sells
        FROM trades
        WHERE market_id = $1 AND status = 'completed'
      `,
        [id]
      ),
      pool.query(
        `
        SELECT 
          EXTRACT(EPOCH FROM DATE_TRUNC('day', to_timestamp(created_at)))::BIGINT as date,
          SUM(total_cost)::bigint as volume,
          COUNT(*)::int as trades
        FROM trades
        WHERE market_id = $1 AND status = 'completed'
        GROUP BY EXTRACT(EPOCH FROM DATE_TRUNC('day', to_timestamp(created_at)))::BIGINT
        ORDER BY date DESC
        LIMIT 30
      `,
        [id]
      ),
    ]);

    if (marketResult.rows.length === 0) {
      return sendNotFound(res, "Market");
    }

    const market = marketResult.rows[0];
    const tradeStats = tradesResult.rows[0];
    const dailyVolume = volumeResult.rows;

    return sendSuccess(res, {
      market: {
        id: market.id,
        question: market.question,
        total_volume: market.total_volume,
        total_options: market.total_options,
        is_resolved: market.is_resolved,
        created_at: market.created_at,
      },
      trade_stats: tradeStats,
      daily_volume: dailyVolume,
    });
  } catch (error: any) {
    console.error("Get market analytics error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /health
 * @desc Health check endpoint
 * @access Public
 */
export const healthCheck = async (req: HealthCheckRequest, res: Response) => {
  try {
    // Check database connection
    await pool.query("SELECT 1");

    return sendSuccess(res, {
      status: "ok",
      timestamp: Math.floor(Date.now() / 1000),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "1.0.0",
    });
  } catch (error: any) {
    return sendError(res, 503, "Database connection failed", {
      timestamp: Math.floor(Date.now() / 1000),
    });
  }
};
