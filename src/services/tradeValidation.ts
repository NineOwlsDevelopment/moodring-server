import { UUID } from "crypto";
import { PoolClient } from "pg";
import {
  BuySharesRequest,
  SellSharesRequest,
  ClaimWinningsRequest,
} from "../types/requests";
import { validateRequired, validateFields } from "../utils/validation";
import { getMoodringData } from "../utils/tradeUtils";

export interface TradeValidationResult {
  isValid: boolean;
  error?: string;
}

export interface BuyValidationResult extends TradeValidationResult {
  buyYes?: number;
  buyNo?: number;
  totalShares?: number;
}

export interface SellValidationResult extends TradeValidationResult {
  sellYes?: number;
  sellNo?: number;
  totalShares?: number;
}

export interface TradeLimits {
  minTradeAmount: number;
  maxTradeAmount: number;
  maxPositionPerMarket: number;
  maxDailyUserVolume: number;
}

export class TradeValidationService {
  private static readonly MAX_TRADE_COST = 100_000_000_000; // 100,000 USDC in micro-units
  private static readonly MAX_SHARES_PER_TRADE = 1_000_000_000_000; // 1,000,000 shares
  // SECURITY FIX (CVE-005): Minimum trade size to prevent precision exploits
  // Minimum: 0.1 USDC = 100,000 micro-USDC
  private static readonly MIN_TRADE_COST = 100_000; // 0.1 USDC in micro-units
  private static readonly MIN_SHARES_PER_TRADE = 100_000; // 0.1 shares (in micro-units)

  /**
   * Validate buy shares request parameters
   */
  static validateBuyRequest(req: BuySharesRequest): BuyValidationResult {
    const { market, option, buyYes, buyNo } = req.body;

    // Validate required fields
    const validation = validateFields([
      validateRequired(market, "Market ID"),
      validateRequired(option, "Option ID"),
    ]);
    if (!validation.isValid) {
      return { isValid: false, error: validation.error! };
    }

    const parsedBuyYes = Math.floor(Number(buyYes)) || 0;
    const parsedBuyNo = Math.floor(Number(buyNo)) || 0;

    if (parsedBuyYes <= 0 && parsedBuyNo <= 0) {
      return { isValid: false, error: "Must buy at least some shares" };
    }

    if (parsedBuyYes > 0 && parsedBuyNo > 0) {
      return { isValid: false, error: "Can only buy YES or NO, not both" };
    }

    // Validate trade size
    const totalShares = parsedBuyYes + parsedBuyNo;

    // SECURITY FIX (CVE-005): Enforce minimum trade size to prevent precision exploits
    if (totalShares < this.MIN_SHARES_PER_TRADE) {
      return {
        isValid: false,
        error: `Minimum trade size is ${
          this.MIN_SHARES_PER_TRADE / 1_000_000
        } shares (0.1 shares) to prevent precision exploits`,
      };
    }

    if (totalShares > this.MAX_SHARES_PER_TRADE) {
      return {
        isValid: false,
        error: `Trade size exceeds maximum allowed (${this.MAX_SHARES_PER_TRADE} shares)`,
      };
    }

    return {
      isValid: true,
      buyYes: parsedBuyYes,
      buyNo: parsedBuyNo,
      totalShares,
    };
  }

  /**
   * Validate sell shares request parameters
   */
  static validateSellRequest(req: SellSharesRequest): SellValidationResult {
    const { market, option, sellYes, sellNo } = req.body;

    // Validate required fields
    const validation = validateFields([
      validateRequired(market, "Market ID"),
      validateRequired(option, "Option ID"),
    ]);
    if (!validation.isValid) {
      return { isValid: false, error: validation.error! };
    }

    const parsedSellYes = Number(sellYes) || 0;
    const parsedSellNo = Number(sellNo) || 0;

    if (parsedSellYes <= 0 && parsedSellNo <= 0) {
      return { isValid: false, error: "Must sell at least some shares" };
    }

    if (parsedSellYes > 0 && parsedSellNo > 0) {
      return { isValid: false, error: "Can only sell YES or NO, not both" };
    }

    // Validate trade size
    const totalShares = parsedSellYes + parsedSellNo;

    // SECURITY FIX (CVE-005): Enforce minimum trade size to prevent precision exploits
    if (totalShares < this.MIN_SHARES_PER_TRADE) {
      return {
        isValid: false,
        error: `Minimum trade size is ${
          this.MIN_SHARES_PER_TRADE / 1_000_000
        } shares (0.1 shares) to prevent precision exploits`,
      };
    }

    if (totalShares > this.MAX_SHARES_PER_TRADE) {
      return {
        isValid: false,
        error: `Trade size exceeds maximum allowed (${this.MAX_SHARES_PER_TRADE} shares)`,
      };
    }

    return {
      isValid: true,
      sellYes: parsedSellYes,
      sellNo: parsedSellNo,
      totalShares,
    };
  }

  /**
   * Validate claim winnings request
   */
  static validateClaimRequest(
    req: ClaimWinningsRequest
  ): TradeValidationResult {
    const { market, option } = req.body;

    const validation = validateFields([
      validateRequired(market, "Market ID"),
      validateRequired(option, "Option ID"),
    ]);

    if (!validation.isValid) {
      return { isValid: false, error: validation.error! };
    }

    return { isValid: true };
  }

  /**
   * Validate trade limits from moodring configuration
   * @param tradeCost - The cost of the trade in micro-USDC (including fees for buys)
   */
  static async validateTradeLimits(
    client: PoolClient,
    tradeCost: number,
    userId: UUID,
    marketId: UUID,
    optionId: UUID,
    isBuy: boolean
  ): Promise<TradeLimits & { isValid: boolean; error?: string }> {
    const moodring = await getMoodringData(client);

    // SECURITY FIX (CVE-005): Enforce minimum trade cost to prevent precision exploits
    // Use the higher of configured minimum or security minimum
    const effectiveMinTradeAmount = Math.max(
      moodring.min_trade_amount,
      this.MIN_TRADE_COST
    );

    // Check trade amount limits (in micro-USDC)
    if (tradeCost < effectiveMinTradeAmount) {
      return {
        isValid: false,
        error: `Trade amount must be at least ${
          effectiveMinTradeAmount / 1_000_000
        } USDC to prevent precision exploits`,
        minTradeAmount: effectiveMinTradeAmount,
        maxTradeAmount: moodring.max_trade_amount,
        maxPositionPerMarket: moodring.max_position_per_market,
        maxDailyUserVolume: moodring.max_daily_user_volume,
      };
    }

    if (tradeCost > moodring.max_trade_amount) {
      return {
        isValid: false,
        error: `Trade amount cannot exceed ${
          moodring.max_trade_amount / 10 ** 6
        } USDC`,
        minTradeAmount: moodring.min_trade_amount,
        maxTradeAmount: moodring.max_trade_amount,
        maxPositionPerMarket: moodring.max_position_per_market,
        maxDailyUserVolume: moodring.max_daily_user_volume,
      };
    }

    // Check position limits for this market (in micro-USDC)
    const userPositionResult = await client.query(
      `SELECT total_yes_cost, total_no_cost FROM user_positions
       WHERE user_id = $1 AND market_id = $2 AND option_id = $3`,
      [userId, marketId, optionId]
    );

    const existingPosition = userPositionResult.rows[0];
    const existingPositionCost =
      Number(existingPosition?.total_yes_cost || 0) +
      Number(existingPosition?.total_no_cost || 0);

    const newTotalPositionCost = isBuy
      ? existingPositionCost + tradeCost
      : existingPositionCost; // For sell, we check if they have enough shares later

    if (isBuy && newTotalPositionCost > moodring.max_position_per_market) {
      return {
        isValid: false,
        error: `This trade would exceed your position limit of ${
          moodring.max_position_per_market / 10 ** 6
        } USDC per market`,
        minTradeAmount: moodring.min_trade_amount,
        maxTradeAmount: moodring.max_trade_amount,
        maxPositionPerMarket: moodring.max_position_per_market,
        maxDailyUserVolume: moodring.max_daily_user_volume,
      };
    }

    // Check daily volume limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTimestamp = Math.floor(todayStart.getTime() / 1000); // Unix timestamp in seconds

    const dailyVolumeResult = await client.query(
      `SELECT COALESCE(SUM(total_cost), 0)::bigint as daily_volume
       FROM trades
       WHERE user_id = $1 AND created_at >= $2`,
      [userId, todayStartTimestamp]
    );

    const dailyVolume = Number(dailyVolumeResult.rows[0]?.daily_volume || 0);
    if (dailyVolume >= moodring.max_daily_user_volume) {
      return {
        isValid: false,
        error: `You have reached your daily trading volume limit of ${moodring.max_daily_user_volume} micro-USDC`,
        minTradeAmount: moodring.min_trade_amount,
        maxTradeAmount: moodring.max_trade_amount,
        maxPositionPerMarket: moodring.max_position_per_market,
        maxDailyUserVolume: moodring.max_daily_user_volume,
      };
    }

    return {
      isValid: true,
      minTradeAmount: moodring.min_trade_amount,
      maxTradeAmount: moodring.max_trade_amount,
      maxPositionPerMarket: moodring.max_position_per_market,
      maxDailyUserVolume: moodring.max_daily_user_volume,
    };
  }

  /**
   * Validate slippage parameters
   * @param slippageBps - Slippage tolerance in basis points (e.g., 100 = 1%)
   * @param maxCost - Maximum allowed cost (alternative to slippageBps)
   * @param expectedTotalCost - Expected total cost including fees (in micro-USDC)
   * @param actualTotalCost - Actual total cost including fees (in micro-USDC)
   */
  static validateSlippage(
    slippageBps?: number,
    maxCost?: number,
    expectedTotalCost?: number,
    actualTotalCost?: number
  ): TradeValidationResult {
    if (
      slippageBps !== undefined &&
      expectedTotalCost !== undefined &&
      actualTotalCost !== undefined
    ) {
      const maxAllowedCost = Math.floor(
        expectedTotalCost * (1 + Number(slippageBps) / 10000)
      );
      if (actualTotalCost > maxAllowedCost) {
        return {
          isValid: false,
          error: `Slippage tolerance exceeded. Expected max: ${
            maxAllowedCost / 10 ** 6
          } USDC, Actual: ${actualTotalCost / 10 ** 6} USDC`,
        };
      }
    } else if (
      maxCost !== undefined &&
      actualTotalCost !== undefined &&
      actualTotalCost > Number(maxCost)
    ) {
      return { isValid: false, error: "Cost exceeds maximum allowed" };
    }

    return { isValid: true };
  }
}
