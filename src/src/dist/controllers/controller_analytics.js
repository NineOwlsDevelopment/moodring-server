"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = exports.getMarketAnalytics = exports.getMyStats = exports.getUserStats = exports.getCreatorsLeaderboard = exports.getProfitLeaderboard = exports.getVolumeLeaderboard = exports.getPlatformStatsHistory = exports.getPlatformStats = void 0;
const PlatformStats_1 = require("../models/PlatformStats");
const UserStats_1 = require("../models/UserStats");
const db_1 = require("../db");
const errors_1 = require("../utils/errors");
/**
 * @route GET /api/analytics/platform
 * @desc Get platform-wide statistics
 * @access Public
 */
const getPlatformStats = async (req, res) => {
    try {
        const aggregateStats = await PlatformStats_1.PlatformStatsModel.getAggregateStats();
        return (0, errors_1.sendSuccess)(res, {
            stats: aggregateStats,
        });
    }
    catch (error) {
        console.error("Get platform stats error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getPlatformStats = getPlatformStats;
/**
 * @route GET /api/analytics/platform/history
 * @desc Get historical platform statistics
 * @access Admin
 */
const getPlatformStatsHistory = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const stats = await PlatformStats_1.PlatformStatsModel.getHistoricalStats(days);
        return (0, errors_1.sendSuccess)(res, {
            stats,
            period_days: days,
        });
    }
    catch (error) {
        console.error("Get platform stats history error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getPlatformStatsHistory = getPlatformStatsHistory;
/**
 * @route GET /api/analytics/leaderboard/volume
 * @desc Get leaderboard by trading volume
 * @access Public
 */
const getVolumeLeaderboard = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 100, 100);
        const leaderboard = await UserStats_1.UserStatsModel.getLeaderboardByVolume(limit);
        return (0, errors_1.sendSuccess)(res, {
            leaderboard,
            metric: "volume",
        });
    }
    catch (error) {
        console.error("Get volume leaderboard error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getVolumeLeaderboard = getVolumeLeaderboard;
/**
 * @route GET /api/analytics/leaderboard/profit
 * @desc Get leaderboard by profit
 * @access Public
 */
const getProfitLeaderboard = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 100, 100);
        const leaderboard = await UserStats_1.UserStatsModel.getLeaderboardByProfit(limit);
        return (0, errors_1.sendSuccess)(res, {
            leaderboard,
            metric: "profit",
        });
    }
    catch (error) {
        console.error("Get profit leaderboard error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getProfitLeaderboard = getProfitLeaderboard;
/**
 * @route GET /api/analytics/leaderboard/creators
 * @desc Get top market creators
 * @access Public
 */
const getCreatorsLeaderboard = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const creators = await PlatformStats_1.CreatorStatsModel.getTopCreators(limit);
        return (0, errors_1.sendSuccess)(res, {
            creators,
        });
    }
    catch (error) {
        console.error("Get creators leaderboard error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getCreatorsLeaderboard = getCreatorsLeaderboard;
/**
 * @route GET /api/analytics/user/:userId
 * @desc Get public stats for a user
 * @access Public
 */
const getUserStats = async (req, res) => {
    try {
        const { userId } = req.params;
        const [userStats, creatorStats, volumeRank, profitRank] = await Promise.all([
            UserStats_1.UserStatsModel.findByUserId(userId),
            PlatformStats_1.CreatorStatsModel.findByUserId(userId),
            UserStats_1.UserStatsModel.getUserRank(userId, "volume"),
            UserStats_1.UserStatsModel.getUserRank(userId, "profit"),
        ]);
        if (!userStats && !creatorStats) {
            return (0, errors_1.sendNotFound)(res, "User stats");
        }
        return (0, errors_1.sendSuccess)(res, {
            trading: userStats
                ? {
                    total_trades: userStats.total_trades,
                    total_volume: userStats.total_volume,
                    winning_trades: userStats.winning_trades,
                    losing_trades: userStats.losing_trades,
                    win_rate: userStats.total_trades > 0
                        ? ((userStats.winning_trades / userStats.total_trades) *
                            100).toFixed(2)
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
    }
    catch (error) {
        console.error("Get user stats error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getUserStats = getUserStats;
/**
 * @route GET /api/analytics/my-stats
 * @desc Get authenticated user's detailed stats
 * @access Private
 */
const getMyStats = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const [userStats, creatorStats, volumeRank, profitRank] = await Promise.all([
            UserStats_1.UserStatsModel.getOrCreate(userId),
            PlatformStats_1.CreatorStatsModel.findByUserId(userId),
            UserStats_1.UserStatsModel.getUserRank(userId, "volume"),
            UserStats_1.UserStatsModel.getUserRank(userId, "profit"),
        ]);
        return (0, errors_1.sendSuccess)(res, {
            trading: {
                total_trades: userStats.total_trades,
                total_volume: userStats.total_volume,
                winning_trades: userStats.winning_trades,
                losing_trades: userStats.losing_trades,
                win_rate: userStats.total_trades > 0
                    ? ((userStats.winning_trades / userStats.total_trades) *
                        100).toFixed(2)
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
    }
    catch (error) {
        console.error("Get my stats error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getMyStats = getMyStats;
/**
 * @route GET /api/analytics/market/:id
 * @desc Get analytics for a specific market
 * @access Public
 */
const getMarketAnalytics = async (req, res) => {
    try {
        const { id } = req.params;
        const [marketResult, tradesResult, volumeResult] = await Promise.all([
            db_1.pool.query("SELECT * FROM markets WHERE id = $1", [id]),
            db_1.pool.query(`
        SELECT 
          COUNT(*)::int as total_trades,
          COUNT(DISTINCT user_id)::int as unique_traders,
          COUNT(*) FILTER (WHERE trade_type = 'buy')::int as buys,
          COUNT(*) FILTER (WHERE trade_type = 'sell')::int as sells
        FROM trades
        WHERE market_id = $1 AND status = 'completed'
      `, [id]),
            db_1.pool.query(`
        SELECT 
          EXTRACT(EPOCH FROM DATE_TRUNC('day', to_timestamp(created_at)))::BIGINT as date,
          SUM(total_cost)::bigint as volume,
          COUNT(*)::int as trades
        FROM trades
        WHERE market_id = $1 AND status = 'completed'
        GROUP BY EXTRACT(EPOCH FROM DATE_TRUNC('day', to_timestamp(created_at)))::BIGINT
        ORDER BY date DESC
        LIMIT 30
      `, [id]),
        ]);
        if (marketResult.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "Market");
        }
        const market = marketResult.rows[0];
        const tradeStats = tradesResult.rows[0];
        const dailyVolume = volumeResult.rows;
        return (0, errors_1.sendSuccess)(res, {
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
    }
    catch (error) {
        console.error("Get market analytics error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getMarketAnalytics = getMarketAnalytics;
/**
 * @route GET /health
 * @desc Health check endpoint
 * @access Public
 */
const healthCheck = async (req, res) => {
    try {
        // Check database connection
        await db_1.pool.query("SELECT 1");
        return (0, errors_1.sendSuccess)(res, {
            status: "ok",
            timestamp: Math.floor(Date.now() / 1000),
            uptime: process.uptime(),
            version: process.env.npm_package_version || "1.0.0",
        });
    }
    catch (error) {
        return (0, errors_1.sendError)(res, 503, "Database connection failed", {
            timestamp: Math.floor(Date.now() / 1000),
        });
    }
};
exports.healthCheck = healthCheck;
//# sourceMappingURL=controller_analytics.js.map