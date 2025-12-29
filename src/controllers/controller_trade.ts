import { Response } from "express";
import { BN } from "@coral-xyz/anchor";
import { UUID } from "crypto";
import { pool } from "../db";
import { TradeModel } from "../models/Trade";
import { ActivityModel } from "../models/Activity";
import { UserStatsModel } from "../models/UserStats";
import { NotificationModel } from "../models/Notification";
import { UserPositionModel } from "../models/UserPosition";
import { PriceSnapshotModel } from "../models/PriceSnapshot";
import { OptionModel } from "../models/Option";
import { MarketModel } from "../models/Market";
import { calculate_yes_price, PRECISION } from "../utils/lmsr";
import {
  emitTradeUpdate,
  emitPriceUpdate,
  emitBalanceUpdate,
  emitMarketUpdate,
} from "../services/websocket";
import { withTransaction, TransactionError } from "../utils/transaction";
import { withTradeQueue } from "../services/tradeQueue";
import {
  sendError,
  sendNotFound,
  sendSuccess,
  sendValidationError,
} from "../utils/errors";
import { validateEnum } from "../utils/validation";
import { TradeValidationService } from "../services/tradeValidation";
import { TradeService } from "../services/tradeService";
import {
  BuySharesRequest,
  SellSharesRequest,
  ClaimWinningsRequest,
  GetPositionRequest,
  GetAllPositionsRequest,
  GetTradeHistoryRequest,
  GetRecentTradesRequest,
  GetMarketTradesRequest,
  GetPriceHistoryRequest,
  GetMarketPriceHistoryRequest,
  GetOHLCDataRequest,
  GetUserTradesRequest,
} from "../types/requests";

/**
 * @route POST /api/trade/buy
 * @desc Buy shares using LMSR pricing
 * @access Private
 *
 * Note: All share quantities are in micro-units (6 decimals) to match USDC precision.
 * 1 share = 1,000,000 micro-shares
 * Cost/payout is also in micro-USDC (6 decimals)
 */
export const buyShares = async (req: BuySharesRequest, res: Response) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    const { market, option, buyYes, buyNo, maxCost, slippageBps } = req.body;

    // Validate buy request
    const validation = TradeValidationService.validateBuyRequest(req);
    if (!validation.isValid) {
      return sendValidationError(res, validation.error!);
    }

    // Queue the trade operation to prevent deadlocks
    const tradeOperation = async (): Promise<any> => {
      return await withTransaction(async (client) => {
        return await TradeService.executeBuy(
          client,
          userId as UUID,
          market as UUID,
          option as UUID,
          validation.buyYes!,
          validation.buyNo!,
          maxCost,
          slippageBps
        );
      });
    };

    const result = await withTradeQueue(
      market as UUID,
      option as UUID,
      tradeOperation
    );

    // Get updated balance for websocket update
    const updatedWalletResult = await pool.query(
      `SELECT balance_usdc FROM wallets WHERE id = $1`,
      [result.wallet.id]
    );
    const newBalance = updatedWalletResult.rows[0]?.balance_usdc || 0;

    // Save trade to database
    const trade = await TradeModel.create({
      user_id: userId as UUID,
      market_id: market as UUID,
      option_id: option as UUID,
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
    const newYesPriceForSnapshot =
      calculate_yes_price(
        new BN(result.newYesQuantity),
        new BN(result.newNoQuantity),
        result.liquidityParam
      ) / PRECISION.toNumber();

    await PriceSnapshotModel.recordPrice({
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
    await ActivityModel.create({
      user_id: userId as UUID,
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
    await UserStatsModel.recordTrade(
      userId,
      result.totalCost,
      result.totalFee,
      false
    );

    // Emit real-time updates via WebSocket
    try {
      emitTradeUpdate({
        market_id: market,
        option_id: option,
        trade_type: "buy",
        side: result.side,
        quantity: result.quantity,
        price: result.pricePerShare / 1_000_000,
        timestamp: new Date(),
      });

      emitPriceUpdate({
        option_id: option,
        yes_price: newYesPriceForSnapshot,
        no_price: 1 - newYesPriceForSnapshot,
        yes_quantity: result.newYesQuantity,
        no_quantity: result.newNoQuantity,
        timestamp: new Date(),
      });

      emitBalanceUpdate({
        user_id: userId,
        balance_usdc: newBalance,
        timestamp: new Date(),
      });

      // Fetch and emit updated market data
      const updatedMarket = await MarketModel.findById(market);
      if (updatedMarket) {
        emitMarketUpdate({
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
    } catch (wsError) {
      console.error("WebSocket emission error:", wsError);
    }

    return sendSuccess(res, {
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
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return sendError(res, error.statusCode, error.message, error.details);
    }
    console.error("Buy shares error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to process trade. Please try again."
    );
  }
};

/**
 * @route POST /api/trade/sell
 * @desc Sell shares using LMSR pricing
 * @access Private
 *
 * Note: All share quantities are in micro-units (6 decimals) to match USDC precision.
 * 1 share = 1,000,000 micro-shares
 * Cost/payout is also in micro-USDC (6 decimals)
 */
export const sellShares = async (req: SellSharesRequest, res: Response) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    const { market, option, sellYes, sellNo, minPayout, slippageBps } =
      req.body;

    // Validate sell request
    const validation = TradeValidationService.validateSellRequest(req);
    if (!validation.isValid) {
      return sendValidationError(res, validation.error!);
    }

    // Queue the trade operation to prevent deadlocks
    const tradeOperation = async (): Promise<any> => {
      return await withTransaction(async (client) => {
        return await TradeService.executeSell(
          client,
          userId as UUID,
          market as UUID,
          option as UUID,
          validation.sellYes!,
          validation.sellNo!,
          minPayout,
          slippageBps
        );
      });
    };

    const result = await withTradeQueue(
      market as UUID,
      option as UUID,
      tradeOperation
    );

    // Get updated balance for websocket update
    const updatedWalletResult = await pool.query(
      `SELECT balance_usdc FROM wallets WHERE id = $1`,
      [result.wallet.id]
    );
    const newBalance = updatedWalletResult.rows[0]?.balance_usdc || 0;

    // Save trade to database
    const trade = await TradeModel.create({
      user_id: userId as UUID,
      market_id: market as UUID,
      option_id: option as UUID,
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
    const newYesPriceForSnapshot =
      calculate_yes_price(
        new BN(result.newYesQuantity),
        new BN(result.newNoQuantity),
        result.liquidityParam
      ) / PRECISION.toNumber();

    await PriceSnapshotModel.recordPrice({
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
    await ActivityModel.create({
      user_id: userId as UUID,
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
    await UserStatsModel.recordTrade(
      userId,
      result.netPayout,
      result.totalFee,
      result.realizedPnl > 0
    );

    // Emit real-time updates via WebSocket
    try {
      emitTradeUpdate({
        market_id: market,
        option_id: option,
        trade_type: "sell",
        side: result.side,
        quantity: result.quantity,
        price: result.pricePerShare / 1_000_000,
        timestamp: new Date(),
      });

      emitPriceUpdate({
        option_id: option,
        yes_price: newYesPriceForSnapshot,
        no_price: 1 - newYesPriceForSnapshot,
        yes_quantity: result.newYesQuantity,
        no_quantity: result.newNoQuantity,
        timestamp: new Date(),
      });

      emitBalanceUpdate({
        user_id: userId,
        balance_usdc: newBalance,
        timestamp: new Date(),
      });

      // Fetch and emit updated market data
      const updatedMarket = await MarketModel.findById(market);
      if (updatedMarket) {
        emitMarketUpdate({
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
    } catch (wsError) {
      console.error("WebSocket emission error:", wsError);
    }

    return sendSuccess(res, {
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
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return sendError(res, error.statusCode, error.message, error.details);
    }
    console.error("Sell shares error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to process trade. Please try again."
    );
  }
};

/**
 * @route POST /api/trade/claim
 * @desc Claim winnings from a resolved option
 * @access Private
 */
export const claimWinnings = async (
  req: ClaimWinningsRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    const { market, option } = req.body;

    // Validate claim request
    const validation = TradeValidationService.validateClaimRequest(req);
    if (!validation.isValid) {
      return sendValidationError(res, validation.error!);
    }

    const result = await withTransaction(async (client) => {
      return await TradeService.executeClaim(
        client,
        userId as UUID,
        market as UUID,
        option as UUID
      );
    });

    // Get updated balance for websocket update (after commit to ensure committed value)
    const updatedWalletResult = await pool.query(
      `SELECT balance_usdc FROM wallets WHERE user_id = $1`,
      [userId]
    );
    const newBalance = updatedWalletResult.rows[0]?.balance_usdc || 0;

    // Emit balance update via websocket
    try {
      emitBalanceUpdate({
        user_id: userId,
        balance_usdc: newBalance,
        timestamp: new Date(),
      });
    } catch (wsError) {
      // Don't fail the claim if websocket emission fails
      console.error("WebSocket emission error:", wsError);
    }

    // Create notification
    await NotificationModel.create({
      user_id: userId as UUID,
      notification_type: "trade_executed",
      title: "Winnings Claimed",
      message: `Your winnings of ${
        result.payout / 1_000_000
      } USDC have been added to your wallet.`,
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
    await ActivityModel.create({
      user_id: userId as UUID,
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

    return sendSuccess(res, {
      message: "Winnings claimed successfully",
      payout: result.payout,
      winning_side: result.winningSide === 1 ? "yes" : "no",
      winning_shares: result.winningShares,
      realized_pnl: result.realizedPnl,
    });
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return sendError(res, error.statusCode, error.message, error.details);
    }
    console.error("Claim winnings error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to claim winnings. Please try again."
    );
  }
};

/**
 * @route GET /api/trade/position/:option
 * @desc Get user's position for an option
 * @access Private
 */
export const getPosition = async (req: GetPositionRequest, res: Response) => {
  try {
    const userId = req.id;
    const { option } = req.params;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    const position = await UserPositionModel.findByUserAndOption(
      userId,
      option
    );

    if (!position) {
      return sendSuccess(res, {
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
    const optionData = await OptionModel.findById(option);
    const marketData = optionData
      ? await MarketModel.findById(optionData.market_id as string)
      : null;

    let currentYesPrice = 0.5;
    let currentNoPrice = 0.5;

    if (optionData && marketData) {
      try {
        const liquidityParam = new BN(marketData.liquidity_parameter);
        currentYesPrice =
          calculate_yes_price(
            new BN(Math.floor(Number(optionData.yes_quantity))),
            new BN(Math.floor(Number(optionData.no_quantity))),
            liquidityParam
          ) / PRECISION.toNumber();
        currentNoPrice = 1 - currentYesPrice;
      } catch (e) {
        // Use defaults
      }
    }

    const currentValue =
      Number(position.yes_shares) * currentYesPrice +
      Number(position.no_shares) * currentNoPrice;
    const costBasis =
      Number(position.total_yes_cost) + Number(position.total_no_cost);
    const unrealizedPnl = currentValue - costBasis;

    return sendSuccess(res, {
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
  } catch (error: any) {
    console.error("Get position error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to get position. Please try again."
    );
  }
};

/**
 * @route GET /api/trade/positions
 * @desc Get all positions for the current user
 * @access Private
 */
export const getAllPositions = async (
  req: GetAllPositionsRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    const positions = await UserPositionModel.findByUser(userId);

    return sendSuccess(res, { positions });
  } catch (error: any) {
    console.error("Get all positions error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to get positions. Please try again."
    );
  }
};

/**
 * @route GET /api/trade/history
 * @desc Get user's trade history
 * @access Private
 */
export const getTradeHistory = async (
  req: GetTradeHistoryRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const { trades, total } = await TradeModel.findByUserId(
      userId,
      limit,
      offset
    );
    const totalPages = Math.ceil(total / limit);

    return sendSuccess(res, {
      trades,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error: any) {
    console.error("Get trade history error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to get trade history. Please try again."
    );
  }
};

/**
 * @route GET /api/trade/user/:userId
 * @desc Get another user's trades (only if current user is following them)
 * @access Private
 */
export const getUserTrades = async (
  req: GetUserTradesRequest,
  res: Response
) => {
  try {
    const currentUserId = req.id;
    if (!currentUserId) {
      return sendError(res, 401, "Unauthorized");
    }

    const { userId } = req.params;
    if (!userId) {
      return sendValidationError(res, "User ID is required");
    }

    // If it's the user's own profile, allow access
    if (currentUserId === userId) {
      // User can always view their own trades
    } else {
      // Check if current user is following the target user
      const followCheck = await pool.query(
        `SELECT 1 FROM user_follows 
         WHERE follower_id = $1 AND following_id = $2`,
        [currentUserId, userId]
      );

      if (followCheck.rows.length === 0) {
        return sendError(
          res,
          403,
          "You must follow this user to view their trades"
        );
      }
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const { trades, total } = await TradeModel.findByUserId(
      userId,
      limit,
      offset
    );
    const totalPages = Math.ceil(total / limit);

    return sendSuccess(res, {
      trades,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error: any) {
    console.error("Get user trades error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to get user trades. Please try again."
    );
  }
};

/**
 * @route GET /api/trade/recent
 * @desc Get recent public trades (DEPRECATED - trades are now private)
 * @access Public
 * @note This endpoint is kept for backward compatibility but returns empty array
 *       Trades are now private and only visible to the user who made them
 */
export const getRecentTrades = async (
  req: GetRecentTradesRequest,
  res: Response
) => {
  try {
    // Trades are now private - return empty array to prevent exposing other users' trades
    return sendSuccess(res, { trades: [] });
  } catch (error: any) {
    console.error("Get recent trades error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to get recent trades. Please try again."
    );
  }
};

/**
 * @route GET /api/trade/market/:id
 * @desc Get trades for a specific market (DEPRECATED - trades are now private)
 * @access Public
 * @note This endpoint is kept for backward compatibility but returns empty array
 *       Trades are now private and only visible to the user who made them
 */
export const getMarketTrades = async (
  req: GetMarketTradesRequest,
  res: Response
) => {
  try {
    // Trades are now private - return empty array to prevent exposing other users' trades
    return sendSuccess(res, {
      trades: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasMore: false,
      },
    });
  } catch (error: any) {
    console.error("Get market trades error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to get market trades. Please try again."
    );
  }
};

/**
 * @route GET /api/trade/price-history/:optionId
 * @desc Get price history for an option (for charts)
 * @access Public
 */
export const getPriceHistory = async (
  req: GetPriceHistoryRequest,
  res: Response
) => {
  try {
    const { optionId } = req.params;
    const timeRange = (req.query.range as string) || "24H";
    const limit = Math.min(parseInt(req.query.limit as string) || 500, 1000);

    // Validate time range
    const validRanges = ["1H", "24H", "7D", "30D", "ALL"];
    const rangeValidation = validateEnum(timeRange, "Time range", validRanges);
    if (!rangeValidation.isValid) {
      return sendValidationError(res, rangeValidation.error!);
    }

    const history = await PriceSnapshotModel.getHistory(
      optionId,
      timeRange as any,
      limit
    );

    return sendSuccess(res, {
      history,
      option_id: optionId,
      time_range: timeRange,
      count: history.length,
    });
  } catch (error: any) {
    console.error("Get price history error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to get price history. Please try again."
    );
  }
};

/**
 * @route GET /api/trade/price-history/market/:marketId
 * @desc Get price history for all options in a market (for multi-choice charts)
 * @access Public
 */
export const getMarketPriceHistory = async (
  req: GetMarketPriceHistoryRequest,
  res: Response
) => {
  try {
    const { marketId } = req.params;
    const timeRange = (req.query.range as string) || "24H";

    // Validate time range
    const validRanges = ["1H", "24H", "7D", "30D", "ALL"];
    const rangeValidation = validateEnum(timeRange, "Time range", validRanges);
    if (!rangeValidation.isValid) {
      return sendValidationError(res, rangeValidation.error!);
    }

    const historyMap = await PriceSnapshotModel.getMarketHistory(
      marketId,
      timeRange as any
    );

    // Convert Map to object for JSON serialization
    const history: Record<string, any[]> = {};
    historyMap.forEach((points, optionId) => {
      history[optionId] = points;
    });

    return sendSuccess(res, {
      history,
      market_id: marketId,
      time_range: timeRange,
    });
  } catch (error: any) {
    console.error("Get market price history error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to get price history. Please try again."
    );
  }
};

/**
 * @route GET /api/trade/ohlc/:optionId
 * @desc Get OHLC candlestick data for an option
 * @access Public
 */
export const getOHLCData = async (req: GetOHLCDataRequest, res: Response) => {
  try {
    const { optionId } = req.params;
    const interval = (req.query.interval as string) || "1h";
    const timeRange = (req.query.range as string) || "7D";
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);

    // Validate interval
    const validIntervals = ["1m", "5m", "15m", "1h", "4h", "1d"];
    const intervalValidation = validateEnum(
      interval,
      "Interval",
      validIntervals
    );
    if (!intervalValidation.isValid) {
      return sendValidationError(res, intervalValidation.error!);
    }

    // Validate time range
    const validRanges = ["1H", "24H", "7D", "30D", "ALL"];
    const rangeValidation = validateEnum(timeRange, "Time range", validRanges);
    if (!rangeValidation.isValid) {
      return sendValidationError(res, rangeValidation.error!);
    }

    const ohlc = await PriceSnapshotModel.getOHLC(
      optionId,
      interval as any,
      timeRange as any,
      limit
    );

    return sendSuccess(res, {
      ohlc,
      option_id: optionId,
      interval,
      time_range: timeRange,
      count: ohlc.length,
    });
  } catch (error: any) {
    console.error("Get OHLC data error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to get OHLC data. Please try again."
    );
  }
};
