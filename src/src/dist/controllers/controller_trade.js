"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOHLCData = exports.getMarketPriceHistory = exports.getPriceHistory = exports.getMarketTrades = exports.getRecentTrades = exports.getUserTrades = exports.getTradeHistory = exports.getAllPositions = exports.getPosition = exports.claimWinnings = exports.sellShares = exports.buyShares = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const db_1 = require("../db");
const Trade_1 = require("../models/Trade");
const Activity_1 = require("../models/Activity");
const UserStats_1 = require("../models/UserStats");
const Notification_1 = require("../models/Notification");
const UserPosition_1 = require("../models/UserPosition");
const PriceSnapshot_1 = require("../models/PriceSnapshot");
const Option_1 = require("../models/Option");
const Market_1 = require("../models/Market");
const lmsr_1 = require("../utils/lmsr");
const websocket_1 = require("../services/websocket");
const transaction_1 = require("../utils/transaction");
const tradeQueue_1 = require("../services/tradeQueue");
const errors_1 = require("../utils/errors");
const validation_1 = require("../utils/validation");
const tradeValidation_1 = require("../services/tradeValidation");
const tradeService_1 = require("../services/tradeService");
/**
 * @route POST /api/trade/buy
 * @desc Buy shares using LMSR pricing
 * @access Private
 *
 * Note: All share quantities are in micro-units (6 decimals) to match USDC precision.
 * 1 share = 1,000,000 micro-shares
 * Cost/payout is also in micro-USDC (6 decimals)
 */
const buyShares = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { market, option, buyYes, buyNo, maxCost, slippageBps } = req.body;
        // Validate buy request
        const validation = tradeValidation_1.TradeValidationService.validateBuyRequest(req);
        if (!validation.isValid) {
            return (0, errors_1.sendValidationError)(res, validation.error);
        }
        // Queue the trade operation to prevent deadlocks
        const tradeOperation = async () => {
            return await (0, transaction_1.withTransaction)(async (client) => {
                return await tradeService_1.TradeService.executeBuy(client, userId, market, option, validation.buyYes, validation.buyNo, maxCost, slippageBps);
            });
        };
        const result = await (0, tradeQueue_1.withTradeQueue)(market, option, tradeOperation);
        // Get updated balance for websocket update
        const updatedWalletResult = await db_1.pool.query(`SELECT balance_usdc FROM wallets WHERE id = $1`, [result.wallet.id]);
        const newBalance = updatedWalletResult.rows[0]?.balance_usdc || 0;
        // Save trade to database
        const trade = await Trade_1.TradeModel.create({
            user_id: userId,
            market_id: market,
            option_id: option,
            trade_type: "buy",
            side: result.side,
            quantity: result.quantity,
            price_per_share: result.pricePerShare,
            total_cost: result.totalCost,
            fees_paid: result.totalFee,
            transaction_signature: undefined,
            status: "completed",
        });
        // Record price snapshot for chart history
        const newYesPriceForSnapshot = (0, lmsr_1.calculate_yes_price)(new anchor_1.BN(result.newYesQuantity), new anchor_1.BN(result.newNoQuantity), result.liquidityParam) / lmsr_1.PRECISION.toNumber();
        await PriceSnapshot_1.PriceSnapshotModel.recordPrice({
            option_id: option,
            market_id: market,
            yes_price: newYesPriceForSnapshot,
            no_price: 1 - newYesPriceForSnapshot,
            yes_quantity: result.newYesQuantity,
            no_quantity: result.newNoQuantity,
            volume: result.totalCost,
            trade_count: 1,
            snapshot_type: "trade",
            trade_id: trade.id,
        });
        // Record activity
        await Activity_1.ActivityModel.create({
            user_id: userId,
            activity_type: "trade",
            entity_type: "option",
            entity_id: option,
            metadata: {
                trade_id: trade.id,
                trade_type: "buy",
                side: result.side,
                quantity: result.quantity,
                total_cost: result.totalCost,
                fees_paid: result.totalFee,
                market_id: market,
            },
        });
        // Update user stats
        await UserStats_1.UserStatsModel.recordTrade(userId, result.totalCost, result.totalFee, false);
        // Emit real-time updates via WebSocket
        try {
            (0, websocket_1.emitTradeUpdate)({
                market_id: market,
                option_id: option,
                trade_type: "buy",
                side: result.side,
                quantity: result.quantity,
                price: result.pricePerShare / 1000000,
                timestamp: new Date(),
            });
            (0, websocket_1.emitPriceUpdate)({
                option_id: option,
                yes_price: newYesPriceForSnapshot,
                no_price: 1 - newYesPriceForSnapshot,
                yes_quantity: result.newYesQuantity,
                no_quantity: result.newNoQuantity,
                timestamp: new Date(),
            });
            (0, websocket_1.emitBalanceUpdate)({
                user_id: userId,
                balance_usdc: newBalance,
                timestamp: new Date(),
            });
            // Fetch and emit updated market data
            const updatedMarket = await Market_1.MarketModel.findById(market);
            if (updatedMarket) {
                (0, websocket_1.emitMarketUpdate)({
                    market_id: market,
                    event: "updated",
                    data: {
                        total_volume: updatedMarket.total_volume,
                        shared_pool_liquidity: updatedMarket.shared_pool_liquidity,
                        resolution_mode: updatedMarket.resolution_mode,
                        total_open_interest: updatedMarket.total_open_interest,
                        is_resolved: updatedMarket.is_resolved,
                    },
                    timestamp: new Date(),
                });
            }
        }
        catch (wsError) {
            console.error("WebSocket emission error:", wsError);
        }
        return (0, errors_1.sendSuccess)(res, {
            message: "Shares bought successfully",
            trade: {
                id: trade.id,
                trade_type: "buy",
                side: result.side,
                quantity: result.quantity,
                total_cost: result.totalCost,
                price_per_share: result.pricePerShare,
                fees_paid: result.totalFee,
            },
        });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Buy shares error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to process trade. Please try again.");
    }
};
exports.buyShares = buyShares;
/**
 * @route POST /api/trade/sell
 * @desc Sell shares using LMSR pricing
 * @access Private
 *
 * Note: All share quantities are in micro-units (6 decimals) to match USDC precision.
 * 1 share = 1,000,000 micro-shares
 * Cost/payout is also in micro-USDC (6 decimals)
 */
const sellShares = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { market, option, sellYes, sellNo, minPayout, slippageBps } = req.body;
        // Validate sell request
        const validation = tradeValidation_1.TradeValidationService.validateSellRequest(req);
        if (!validation.isValid) {
            return (0, errors_1.sendValidationError)(res, validation.error);
        }
        // Queue the trade operation to prevent deadlocks
        const tradeOperation = async () => {
            return await (0, transaction_1.withTransaction)(async (client) => {
                return await tradeService_1.TradeService.executeSell(client, userId, market, option, validation.sellYes, validation.sellNo, minPayout, slippageBps);
            });
        };
        const result = await (0, tradeQueue_1.withTradeQueue)(market, option, tradeOperation);
        // Get updated balance for websocket update
        const updatedWalletResult = await db_1.pool.query(`SELECT balance_usdc FROM wallets WHERE id = $1`, [result.wallet.id]);
        const newBalance = updatedWalletResult.rows[0]?.balance_usdc || 0;
        // Save trade to database
        const trade = await Trade_1.TradeModel.create({
            user_id: userId,
            market_id: market,
            option_id: option,
            trade_type: "sell",
            side: result.side,
            quantity: result.quantity,
            price_per_share: result.pricePerShare,
            total_cost: result.netPayout,
            fees_paid: result.totalFee,
            transaction_signature: undefined,
            status: "completed",
        });
        // Record price snapshot for chart history
        const newYesPriceForSnapshot = (0, lmsr_1.calculate_yes_price)(new anchor_1.BN(result.newYesQuantity), new anchor_1.BN(result.newNoQuantity), result.liquidityParam) / lmsr_1.PRECISION.toNumber();
        await PriceSnapshot_1.PriceSnapshotModel.recordPrice({
            option_id: option,
            market_id: market,
            yes_price: newYesPriceForSnapshot,
            no_price: 1 - newYesPriceForSnapshot,
            yes_quantity: result.newYesQuantity,
            no_quantity: result.newNoQuantity,
            volume: result.rawCost,
            trade_count: 1,
            snapshot_type: "trade",
            trade_id: trade.id,
        });
        // Record activity
        await Activity_1.ActivityModel.create({
            user_id: userId,
            activity_type: "trade",
            entity_type: "option",
            entity_id: option,
            metadata: {
                trade_id: trade.id,
                trade_type: "sell",
                side: result.side,
                quantity: result.quantity,
                total_payout: result.netPayout,
                fees_paid: result.totalFee,
                realized_pnl: result.realizedPnl,
                market_id: market,
            },
        });
        // Update user stats
        await UserStats_1.UserStatsModel.recordTrade(userId, result.netPayout, result.totalFee, result.realizedPnl > 0);
        // Emit real-time updates via WebSocket
        try {
            (0, websocket_1.emitTradeUpdate)({
                market_id: market,
                option_id: option,
                trade_type: "sell",
                side: result.side,
                quantity: result.quantity,
                price: result.pricePerShare / 1000000,
                timestamp: new Date(),
            });
            (0, websocket_1.emitPriceUpdate)({
                option_id: option,
                yes_price: newYesPriceForSnapshot,
                no_price: 1 - newYesPriceForSnapshot,
                yes_quantity: result.newYesQuantity,
                no_quantity: result.newNoQuantity,
                timestamp: new Date(),
            });
            (0, websocket_1.emitBalanceUpdate)({
                user_id: userId,
                balance_usdc: newBalance,
                timestamp: new Date(),
            });
            // Fetch and emit updated market data
            const updatedMarket = await Market_1.MarketModel.findById(market);
            if (updatedMarket) {
                (0, websocket_1.emitMarketUpdate)({
                    market_id: market,
                    event: "updated",
                    data: {
                        total_volume: updatedMarket.total_volume,
                        shared_pool_liquidity: updatedMarket.shared_pool_liquidity,
                        accumulated_lp_fees: updatedMarket.accumulated_lp_fees,
                        resolution_mode: updatedMarket.resolution_mode,
                        total_open_interest: updatedMarket.total_open_interest,
                        is_resolved: updatedMarket.is_resolved,
                    },
                    timestamp: new Date(),
                });
            }
        }
        catch (wsError) {
            console.error("WebSocket emission error:", wsError);
        }
        return (0, errors_1.sendSuccess)(res, {
            message: "Shares sold successfully",
            trade: {
                id: trade.id,
                trade_type: "sell",
                side: result.side,
                quantity: result.quantity,
                net_payout: result.netPayout,
                price_per_share: result.pricePerShare,
                fees_paid: result.totalFee,
                realized_pnl: result.realizedPnl,
            },
        });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Sell shares error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to process trade. Please try again.");
    }
};
exports.sellShares = sellShares;
/**
 * @route POST /api/trade/claim
 * @desc Claim winnings from a resolved option
 * @access Private
 */
const claimWinnings = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { market, option } = req.body;
        // Validate claim request
        const validation = tradeValidation_1.TradeValidationService.validateClaimRequest(req);
        if (!validation.isValid) {
            return (0, errors_1.sendValidationError)(res, validation.error);
        }
        const result = await (0, transaction_1.withTransaction)(async (client) => {
            return await tradeService_1.TradeService.executeClaim(client, userId, market, option);
        });
        // Get updated balance for websocket update (after commit to ensure committed value)
        const updatedWalletResult = await db_1.pool.query(`SELECT balance_usdc FROM wallets WHERE user_id = $1`, [userId]);
        const newBalance = updatedWalletResult.rows[0]?.balance_usdc || 0;
        // Emit balance update via websocket
        try {
            (0, websocket_1.emitBalanceUpdate)({
                user_id: userId,
                balance_usdc: newBalance,
                timestamp: new Date(),
            });
        }
        catch (wsError) {
            // Don't fail the claim if websocket emission fails
            console.error("WebSocket emission error:", wsError);
        }
        // Create notification
        await Notification_1.NotificationModel.create({
            user_id: userId,
            notification_type: "trade_executed",
            title: "Winnings Claimed",
            message: `Your winnings of ${result.payout / 1000000} USDC have been added to your wallet.`,
            entity_type: "option",
            entity_id: option,
            metadata: {
                market_id: market,
                payout: result.payout,
                winning_side: result.winningSide === 1 ? "yes" : "no",
                winning_shares: result.winningShares,
                realized_pnl: result.realizedPnl,
            },
        });
        // Record activity
        await Activity_1.ActivityModel.create({
            user_id: userId,
            activity_type: "claim",
            entity_type: "option",
            entity_id: option,
            metadata: {
                payout: result.payout,
                winning_side: result.winningSide === 1 ? "yes" : "no",
                winning_shares: result.winningShares,
                realized_pnl: result.realizedPnl,
                market_id: market,
            },
        });
        return (0, errors_1.sendSuccess)(res, {
            message: "Winnings claimed successfully",
            payout: result.payout,
            winning_side: result.winningSide === 1 ? "yes" : "no",
            winning_shares: result.winningShares,
            realized_pnl: result.realizedPnl,
        });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Claim winnings error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to claim winnings. Please try again.");
    }
};
exports.claimWinnings = claimWinnings;
/**
 * @route GET /api/trade/position/:option
 * @desc Get user's position for an option
 * @access Private
 */
const getPosition = async (req, res) => {
    try {
        const userId = req.id;
        const { option } = req.params;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const position = await UserPosition_1.UserPositionModel.findByUserAndOption(userId, option);
        if (!position) {
            return (0, errors_1.sendSuccess)(res, {
                position: {
                    yes_shares: 0,
                    no_shares: 0,
                    avg_yes_price: 0,
                    avg_no_price: 0,
                    total_yes_cost: 0,
                    total_no_cost: 0,
                    realized_pnl: 0,
                },
            });
        }
        // Get current prices for unrealized PnL calculation
        const optionData = await Option_1.OptionModel.findById(option);
        const marketData = optionData
            ? await Market_1.MarketModel.findById(optionData.market_id)
            : null;
        let currentYesPrice = 0.5;
        let currentNoPrice = 0.5;
        if (optionData && marketData) {
            try {
                const liquidityParam = new anchor_1.BN(marketData.liquidity_parameter);
                currentYesPrice =
                    (0, lmsr_1.calculate_yes_price)(new anchor_1.BN(Math.floor(Number(optionData.yes_quantity))), new anchor_1.BN(Math.floor(Number(optionData.no_quantity))), liquidityParam) / lmsr_1.PRECISION.toNumber();
                currentNoPrice = 1 - currentYesPrice;
            }
            catch (e) {
                // Use defaults
            }
        }
        const currentValue = Number(position.yes_shares) * currentYesPrice +
            Number(position.no_shares) * currentNoPrice;
        const costBasis = Number(position.total_yes_cost) + Number(position.total_no_cost);
        const unrealizedPnl = currentValue - costBasis;
        return (0, errors_1.sendSuccess)(res, {
            position: {
                ...position,
                yes_shares: Number(position.yes_shares),
                no_shares: Number(position.no_shares),
                avg_yes_price: Number(position.avg_yes_price),
                avg_no_price: Number(position.avg_no_price),
                total_yes_cost: Number(position.total_yes_cost),
                total_no_cost: Number(position.total_no_cost),
                realized_pnl: Number(position.realized_pnl),
                current_yes_price: currentYesPrice,
                current_no_price: currentNoPrice,
                current_value: currentValue,
                unrealized_pnl: unrealizedPnl,
            },
        });
    }
    catch (error) {
        console.error("Get position error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to get position. Please try again.");
    }
};
exports.getPosition = getPosition;
/**
 * @route GET /api/trade/positions
 * @desc Get all positions for the current user
 * @access Private
 */
const getAllPositions = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const positions = await UserPosition_1.UserPositionModel.findByUser(userId);
        return (0, errors_1.sendSuccess)(res, { positions });
    }
    catch (error) {
        console.error("Get all positions error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to get positions. Please try again.");
    }
};
exports.getAllPositions = getAllPositions;
/**
 * @route GET /api/trade/history
 * @desc Get user's trade history
 * @access Private
 */
const getTradeHistory = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;
        const { trades, total } = await Trade_1.TradeModel.findByUserId(userId, limit, offset);
        const totalPages = Math.ceil(total / limit);
        return (0, errors_1.sendSuccess)(res, {
            trades,
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
        console.error("Get trade history error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to get trade history. Please try again.");
    }
};
exports.getTradeHistory = getTradeHistory;
/**
 * @route GET /api/trade/user/:userId
 * @desc Get another user's trades (only if current user is following them)
 * @access Private
 */
const getUserTrades = async (req, res) => {
    try {
        const currentUserId = req.id;
        if (!currentUserId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { userId } = req.params;
        if (!userId) {
            return (0, errors_1.sendValidationError)(res, "User ID is required");
        }
        // If it's the user's own profile, allow access
        if (currentUserId === userId) {
            // User can always view their own trades
        }
        else {
            // Check if current user is following the target user
            const followCheck = await db_1.pool.query(`SELECT 1 FROM user_follows 
         WHERE follower_id = $1 AND following_id = $2`, [currentUserId, userId]);
            if (followCheck.rows.length === 0) {
                return (0, errors_1.sendError)(res, 403, "You must follow this user to view their trades");
            }
        }
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;
        const { trades, total } = await Trade_1.TradeModel.findByUserId(userId, limit, offset);
        const totalPages = Math.ceil(total / limit);
        return (0, errors_1.sendSuccess)(res, {
            trades,
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
        console.error("Get user trades error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to get user trades. Please try again.");
    }
};
exports.getUserTrades = getUserTrades;
/**
 * @route GET /api/trade/recent
 * @desc Get recent public trades (DEPRECATED - trades are now private)
 * @access Public
 * @note This endpoint is kept for backward compatibility but returns empty array
 *       Trades are now private and only visible to the user who made them
 */
const getRecentTrades = async (req, res) => {
    try {
        // Trades are now private - return empty array to prevent exposing other users' trades
        return (0, errors_1.sendSuccess)(res, { trades: [] });
    }
    catch (error) {
        console.error("Get recent trades error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to get recent trades. Please try again.");
    }
};
exports.getRecentTrades = getRecentTrades;
/**
 * @route GET /api/trade/market/:id
 * @desc Get trades for a specific market (DEPRECATED - trades are now private)
 * @access Public
 * @note This endpoint is kept for backward compatibility but returns empty array
 *       Trades are now private and only visible to the user who made them
 */
const getMarketTrades = async (req, res) => {
    try {
        // Trades are now private - return empty array to prevent exposing other users' trades
        return (0, errors_1.sendSuccess)(res, {
            trades: [],
            pagination: {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0,
                hasMore: false,
            },
        });
    }
    catch (error) {
        console.error("Get market trades error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to get market trades. Please try again.");
    }
};
exports.getMarketTrades = getMarketTrades;
/**
 * @route GET /api/trade/price-history/:optionId
 * @desc Get price history for an option (for charts)
 * @access Public
 */
const getPriceHistory = async (req, res) => {
    try {
        const { optionId } = req.params;
        const timeRange = req.query.range || "24H";
        const limit = Math.min(parseInt(req.query.limit) || 500, 1000);
        // Validate time range
        const validRanges = ["1H", "24H", "7D", "30D", "ALL"];
        const rangeValidation = (0, validation_1.validateEnum)(timeRange, "Time range", validRanges);
        if (!rangeValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, rangeValidation.error);
        }
        const history = await PriceSnapshot_1.PriceSnapshotModel.getHistory(optionId, timeRange, limit);
        return (0, errors_1.sendSuccess)(res, {
            history,
            option_id: optionId,
            time_range: timeRange,
            count: history.length,
        });
    }
    catch (error) {
        console.error("Get price history error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to get price history. Please try again.");
    }
};
exports.getPriceHistory = getPriceHistory;
/**
 * @route GET /api/trade/price-history/market/:marketId
 * @desc Get price history for all options in a market (for multi-choice charts)
 * @access Public
 */
const getMarketPriceHistory = async (req, res) => {
    try {
        const { marketId } = req.params;
        const timeRange = req.query.range || "24H";
        // Validate time range
        const validRanges = ["1H", "24H", "7D", "30D", "ALL"];
        const rangeValidation = (0, validation_1.validateEnum)(timeRange, "Time range", validRanges);
        if (!rangeValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, rangeValidation.error);
        }
        const historyMap = await PriceSnapshot_1.PriceSnapshotModel.getMarketHistory(marketId, timeRange);
        // Convert Map to object for JSON serialization
        const history = {};
        historyMap.forEach((points, optionId) => {
            history[optionId] = points;
        });
        return (0, errors_1.sendSuccess)(res, {
            history,
            market_id: marketId,
            time_range: timeRange,
        });
    }
    catch (error) {
        console.error("Get market price history error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to get price history. Please try again.");
    }
};
exports.getMarketPriceHistory = getMarketPriceHistory;
/**
 * @route GET /api/trade/ohlc/:optionId
 * @desc Get OHLC candlestick data for an option
 * @access Public
 */
const getOHLCData = async (req, res) => {
    try {
        const { optionId } = req.params;
        const interval = req.query.interval || "1h";
        const timeRange = req.query.range || "7D";
        const limit = Math.min(parseInt(req.query.limit) || 200, 500);
        // Validate interval
        const validIntervals = ["1m", "5m", "15m", "1h", "4h", "1d"];
        const intervalValidation = (0, validation_1.validateEnum)(interval, "Interval", validIntervals);
        if (!intervalValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, intervalValidation.error);
        }
        // Validate time range
        const validRanges = ["1H", "24H", "7D", "30D", "ALL"];
        const rangeValidation = (0, validation_1.validateEnum)(timeRange, "Time range", validRanges);
        if (!rangeValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, rangeValidation.error);
        }
        const ohlc = await PriceSnapshot_1.PriceSnapshotModel.getOHLC(optionId, interval, timeRange, limit);
        return (0, errors_1.sendSuccess)(res, {
            ohlc,
            option_id: optionId,
            interval,
            time_range: timeRange,
            count: ohlc.length,
        });
    }
    catch (error) {
        console.error("Get OHLC data error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to get OHLC data. Please try again.");
    }
};
exports.getOHLCData = getOHLCData;
//# sourceMappingURL=controller_trade.js.map