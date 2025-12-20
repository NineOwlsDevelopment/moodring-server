import { UUID } from "crypto";
import { BN } from "@coral-xyz/anchor";
import { PoolClient } from "pg";
import { TransactionError } from "../utils/transaction";
import {
  calculate_buy_cost,
  calculate_sell_payout,
  calculate_yes_price,
  PRECISION,
} from "../utils/lmsr";
import { calculateFees, getMoodringData } from "../utils/tradeUtils";
import { TradeValidationService } from "./tradeValidation";
import { RiskControlService } from "./riskControl";
import { CommonTradeOperations } from "./commonTradeOperations";
import { MoodringModel } from "../models/Moodring";

export interface TradeResult {
  wallet: any;
  newYesQuantity: number;
  newNoQuantity: number;
  liquidityParam: BN;
  side: "yes" | "no";
  quantity: number;
  rawCost: number;
  totalCost: number;
  totalFee: number;
  pricePerShare: number;
}

export interface SellTradeResult extends TradeResult {
  netPayout: number;
  realizedPnl: number;
}

export interface ClaimResult {
  payout: number;
  winningSide: number;
  winningShares: number;
  realizedPnl: number;
}

export class TradeService {
  /**
   * Execute a buy trade
   */
  static async executeBuy(
    client: PoolClient,
    userId: UUID,
    marketId: UUID,
    optionId: UUID,
    buyYes: number,
    buyNo: number,
    maxCost?: number,
    slippageBps?: number
  ): Promise<TradeResult> {
    // Pre-trade checks
    await CommonTradeOperations.performPreTradeChecks(client);

    // Get and lock resources in consistent order
    const marketData = await CommonTradeOperations.getMarketWithLock(
      client,
      marketId
    );
    const optionData = await CommonTradeOperations.getOptionWithLock(
      client,
      optionId
    );
    const wallet = await CommonTradeOperations.getWalletWithLock(
      client,
      userId
    );

    // Calculate cost using LMSR
    const liquidityParam = new BN(marketData.liquidity_parameter);
    const currentYes = new BN(Math.floor(Number(optionData.yes_quantity)));
    const currentNo = new BN(Math.floor(Number(optionData.no_quantity)));

    let cost: BN;
    try {
      cost = calculate_buy_cost(
        currentYes,
        currentNo,
        new BN(buyYes),
        new BN(buyNo),
        liquidityParam
      );
    } catch (error) {
      throw new TransactionError(400, "Failed to calculate cost");
    }

    // Minimum cost check
    if (Number(cost) < 0.01) {
      cost = new BN(0.01 * 1_000_000);
    }

    const rawCost = Number(cost);
    const moodring = await getMoodringData(client);

    // Calculate fees
    const { protocolFee, creatorFee, lpFee, totalFee, netAmount } =
      calculateFees(
        rawCost,
        Number(moodring.protocol_fee_rate),
        Number(moodring.creator_fee_rate),
        Number(moodring.lp_fee_rate)
      );

    const totalCost = rawCost + totalFee;

    // Validate trade limits (after cost calculation, using total cost in micro-USDC)
    const limitsCheck = await TradeValidationService.validateTradeLimits(
      client,
      totalCost,
      userId,
      marketId,
      optionId,
      true
    );
    if (!limitsCheck.isValid) {
      throw new TransactionError(400, limitsCheck.error!);
    }

    // Calculate trade details for risk checks
    const side = buyYes > 0 ? "yes" : "no";
    const quantity = buyYes > 0 ? buyYes : buyNo;
    const pricePerShare =
      quantity > 0 ? Math.floor((rawCost * 1_000_000) / quantity) : 0;

    // Perform risk checks
    const riskCheck = await RiskControlService.performRiskChecks(client, {
      userId,
      marketId,
      optionId,
      tradeType: "buy",
      side,
      quantity,
      totalAmount: totalCost,
      pricePerShare,
      currentYes,
      currentNo,
      buyYes,
      buyNo,
      liquidityParam,
    });

    if (!riskCheck.passed) {
      throw new TransactionError(400, riskCheck.error!, riskCheck.details);
    }

    // Check slippage
    // maxCost should be the expected total cost (including fees) that the user is willing to pay
    // slippageBps is the slippage tolerance in basis points
    // If both are provided, maxCost is the maximum allowed cost with slippage already applied
    // If only maxCost is provided, use it directly
    // If only slippageBps is provided, we can't validate without expected cost (skip validation)
    let expectedTotalCost: number | undefined;
    if (maxCost !== undefined) {
      // maxCost is the expected total cost (including fees) that user is willing to pay
      expectedTotalCost = Number(maxCost);
    }

    const slippageCheck = TradeValidationService.validateSlippage(
      slippageBps,
      maxCost,
      expectedTotalCost,
      totalCost
    );
    if (!slippageCheck.isValid) {
      throw new TransactionError(400, slippageCheck.error!);
    }

    // Check balance
    CommonTradeOperations.checkWalletBalance(wallet, totalCost);

    // Execute trade
    // Deduct from wallet
    const newBalance = wallet.balance_usdc - totalCost;
    await CommonTradeOperations.updateWalletBalance(
      client,
      wallet.id,
      newBalance
    );

    // Update option quantities
    const newYesQuantity = Number(optionData.yes_quantity) + buyYes;
    const newNoQuantity = Number(optionData.no_quantity) + buyNo;
    await CommonTradeOperations.updateOptionQuantities(
      client,
      optionId,
      newYesQuantity,
      newNoQuantity
    );

    // Update market stats and shared pool liquidity
    const newPoolLiquidity =
      Number(marketData.shared_pool_liquidity || 0) + rawCost;
    await CommonTradeOperations.updateMarketStats(
      client,
      marketId,
      totalCost,
      buyYes + buyNo,
      creatorFee,
      protocolFee,
      lpFee,
      rawCost
    );

    // Track protocol fees
    if (protocolFee > 0) {
      await MoodringModel.recordFees(creatorFee, protocolFee, client);
    }

    // Create/update user position
    await CommonTradeOperations.upsertUserPosition(
      client,
      userId,
      marketId,
      optionId
    );
    await CommonTradeOperations.updatePositionShares(
      client,
      userId,
      optionId,
      side,
      quantity,
      rawCost
    );

    return {
      wallet,
      newYesQuantity,
      newNoQuantity,
      liquidityParam,
      side: side as "yes" | "no",
      quantity,
      rawCost,
      totalCost,
      totalFee,
      pricePerShare,
    };
  }

  /**
   * Execute a sell trade
   */
  static async executeSell(
    client: PoolClient,
    userId: UUID,
    marketId: UUID,
    optionId: UUID,
    sellYes: number,
    sellNo: number,
    minPayout?: number,
    slippageBps?: number
  ): Promise<SellTradeResult> {
    // Pre-trade checks
    await CommonTradeOperations.performPreTradeChecks(client);

    // Get and lock resources in consistent order
    const marketData = await CommonTradeOperations.getMarketWithLock(
      client,
      marketId
    );
    const optionData = await CommonTradeOperations.getOptionWithLock(
      client,
      optionId
    );
    const position = await CommonTradeOperations.getUserPositionWithLock(
      client,
      userId,
      optionId
    );

    // Check sufficient shares
    CommonTradeOperations.checkSufficientShares(position, sellYes, sellNo);

    // Calculate payout using LMSR
    const liquidityParam = new BN(marketData.liquidity_parameter);
    const currentYes = new BN(Math.floor(Number(optionData.yes_quantity)));
    const currentNo = new BN(Math.floor(Number(optionData.no_quantity)));

    let payout: BN;
    try {
      payout = calculate_sell_payout(
        currentYes,
        currentNo,
        new BN(sellYes),
        new BN(sellNo),
        liquidityParam
      );
    } catch (error) {
      throw new TransactionError(400, "Failed to calculate payout");
    }

    const rawPayout = payout.toNumber();
    const moodring = await getMoodringData(client);

    // Calculate fees (fees are deducted from payout)
    const { protocolFee, creatorFee, lpFee, totalFee } = calculateFees(
      rawPayout,
      Number(moodring.protocol_fee_rate),
      Number(moodring.creator_fee_rate),
      Number(moodring.lp_fee_rate)
    );
    const netPayout = rawPayout - totalFee;

    // Validate trade limits (after payout calculation, using raw payout value in micro-USDC)
    // For sells, we validate based on the payout amount (trade size)
    const limitsCheck = await TradeValidationService.validateTradeLimits(
      client,
      rawPayout,
      userId,
      marketId,
      optionId,
      false
    );
    if (!limitsCheck.isValid) {
      throw new TransactionError(400, limitsCheck.error!);
    }

    // Calculate trade details for risk checks
    const side = sellYes > 0 ? "yes" : "no";
    const quantity = sellYes > 0 ? sellYes : sellNo;
    const pricePerShare =
      quantity > 0 ? Math.floor((netPayout * 1_000_000) / quantity) : 0;

    // Perform risk checks
    const riskCheck = await RiskControlService.performRiskChecks(client, {
      userId,
      marketId,
      optionId,
      tradeType: "sell",
      side,
      quantity,
      totalAmount: rawPayout,
      pricePerShare,
      currentYes,
      currentNo,
      sellYes,
      sellNo,
      liquidityParam,
    });

    if (!riskCheck.passed) {
      throw new TransactionError(400, riskCheck.error!, riskCheck.details);
    }

    // Check slippage/min payout
    // For sells, slippage applies to net payout (after fees)
    // minPayout should be the expected net payout that the user is willing to accept
    // slippageBps is the slippage tolerance in basis points
    // If both are provided, minPayout is the minimum allowed payout with slippage already applied
    // If only minPayout is provided, use it directly
    // If only slippageBps is provided, we can't validate without expected payout (skip validation)
    if (minPayout !== undefined) {
      const expectedNetPayout = Number(minPayout);
      if (slippageBps !== undefined) {
        // Apply slippage tolerance: actual must be >= expected * (1 - slippageBps/10000)
        const minAllowedNetPayout = Math.floor(
          expectedNetPayout * (1 - Number(slippageBps) / 10000)
        );
        if (netPayout < minAllowedNetPayout) {
          throw new TransactionError(
            400,
            `Slippage tolerance exceeded. Expected min: ${
              minAllowedNetPayout / 10 ** 6
            } USDC, Actual: ${netPayout / 10 ** 6} USDC`
          );
        }
      } else {
        // No slippage tolerance, just check minimum
        if (netPayout < expectedNetPayout) {
          throw new TransactionError(400, "Payout below minimum");
        }
      }
    }

    // Check pool liquidity
    CommonTradeOperations.checkPoolLiquidity(marketData, rawPayout);

    // Get wallet with lock
    const wallet = await CommonTradeOperations.getWalletWithLock(
      client,
      userId
    );

    // Calculate realized PnL
    const avgPrice =
      side === "yes"
        ? BigInt(Math.round(Number(position?.avg_yes_price || 0)))
        : BigInt(Math.round(Number(position?.avg_no_price || 0)));
    const costBasis = Number(BigInt(quantity) * avgPrice);
    const realizedPnl = netPayout - costBasis;

    // Execute trade
    // Deduct raw payout from shared pool
    const newPoolLiquidity = Math.max(
      0,
      Number(marketData.shared_pool_liquidity || 0) - rawPayout
    );

    // Credit wallet
    const newBalance = Number(wallet.balance_usdc) + netPayout;
    await CommonTradeOperations.updateWalletBalance(
      client,
      wallet.id,
      newBalance
    );

    // Update option quantities
    const newYesQuantity = Number(optionData.yes_quantity) - sellYes;
    const newNoQuantity = Number(optionData.no_quantity) - sellNo;
    await CommonTradeOperations.updateOptionQuantities(
      client,
      optionId,
      newYesQuantity,
      newNoQuantity
    );

    // Update market stats
    await CommonTradeOperations.updateMarketStats(
      client,
      marketId,
      rawPayout,
      -(sellYes + sellNo), // Decrease open interest
      creatorFee,
      protocolFee,
      lpFee,
      -rawPayout
    );

    // Track protocol fees
    if (protocolFee > 0) {
      await MoodringModel.recordFees(creatorFee, protocolFee, client);
    }

    // Update user position
    await this.updatePositionForSell(
      client,
      userId,
      optionId,
      side,
      quantity,
      realizedPnl
    );

    return {
      wallet,
      newYesQuantity,
      newNoQuantity,
      liquidityParam,
      side: side as "yes" | "no",
      quantity,
      rawCost: rawPayout,
      totalCost: rawPayout,
      totalFee,
      pricePerShare,
      netPayout,
      realizedPnl,
    };
  }

  /**
   * Execute claim winnings
   */
  static async executeClaim(
    client: PoolClient,
    userId: UUID,
    marketId: UUID,
    optionId: UUID
  ): Promise<ClaimResult> {
    // Get option (must be resolved)
    const optionData = await CommonTradeOperations.getOption(client, optionId);

    if (!optionData.is_resolved) {
      throw new TransactionError(400, "Option is not resolved yet");
    }

    // Get user position with lock
    const position = await CommonTradeOperations.getUserPositionWithLock(
      client,
      userId,
      optionId
    );

    if (!position) {
      throw new TransactionError(404, "No position found");
    }

    if (position.is_claimed) {
      throw new TransactionError(
        400,
        "Winnings have already been claimed for this position"
      );
    }

    const yesShares = Number(position.yes_shares);
    const noShares = Number(position.no_shares);

    if (yesShares <= 0 && noShares <= 0) {
      throw new TransactionError(400, "No shares to claim");
    }

    // winning_side: 1 = YES, 2 = NO
    const winningSide = optionData.winning_side;
    const winningShares = winningSide === 1 ? yesShares : noShares;

    // Payout is 1 micro-USDC per micro-share (shares are now stored in 6 decimal format)
    const payout = winningShares;

    // Calculate PnL
    const totalCostBasis =
      Number(position.total_yes_cost) + Number(position.total_no_cost);
    const realizedPnl = payout - totalCostBasis;

    // Get market with lock
    const marketData = await CommonTradeOperations.getMarketWithLock(
      client,
      marketId
    );

    // Check pool liquidity
    CommonTradeOperations.checkPoolLiquidity(marketData, payout);

    // Get wallet with lock
    const wallet = await CommonTradeOperations.getWalletWithLock(
      client,
      userId
    );

    // Deduct payout from shared pool
    const newPoolLiquidity = Math.max(
      0,
      Number(marketData.shared_pool_liquidity || 0) - payout
    );

    // Update market shared pool liquidity
    await client.query(
      `UPDATE markets SET
        shared_pool_liquidity = $1,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
       WHERE id = $2`,
      [newPoolLiquidity, marketId]
    );

    // Credit wallet
    const newBalance = Number(wallet.balance_usdc) + payout;
    await CommonTradeOperations.updateWalletBalance(
      client,
      wallet.id,
      newBalance
    );

    // Zero out position and mark as claimed
    await client.query(
      `UPDATE user_positions SET
        yes_shares = 0,
        no_shares = 0,
        total_yes_cost = 0,
        total_no_cost = 0,
        realized_pnl = realized_pnl + $1,
        is_claimed = TRUE,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
       WHERE user_id = $2 AND option_id = $3`,
      [realizedPnl, userId, optionId]
    );

    return {
      payout: payout || 0,
      winningSide: winningSide || 0,
      winningShares: winningShares || 0,
      realizedPnl: realizedPnl || 0,
    };
  }

  /**
   * Update position for sell operation
   */
  private static async updatePositionForSell(
    client: PoolClient,
    userId: UUID,
    optionId: UUID,
    side: "yes" | "no",
    quantity: number,
    realizedPnl: number
  ): Promise<void> {
    // Get current position
    const positionResult = await client.query(
      `SELECT * FROM user_positions WHERE user_id = $1 AND option_id = $2`,
      [userId, optionId]
    );
    const currentPosition = positionResult.rows[0];

    if (!currentPosition) {
      throw new TransactionError(404, "Position not found");
    }

    if (side === "yes") {
      const newYesShares = Number(currentPosition.yes_shares) - quantity;
      const newTotalYesCost = Number(
        BigInt(newYesShares) *
          BigInt(Math.round(Number(currentPosition.avg_yes_price)))
      );

      await client.query(
        `UPDATE user_positions SET
          yes_shares = $1,
          total_yes_cost = $2,
          realized_pnl = realized_pnl + $3,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
         WHERE user_id = $4 AND option_id = $5`,
        [
          newYesShares,
          newTotalYesCost,
          Math.round(realizedPnl),
          userId,
          optionId,
        ]
      );
    } else {
      const newNoShares = Number(currentPosition.no_shares) - quantity;
      const newTotalNoCost = Number(
        BigInt(newNoShares) *
          BigInt(Math.round(Number(currentPosition.avg_no_price)))
      );

      await client.query(
        `UPDATE user_positions SET
          no_shares = $1,
          total_no_cost = $2,
          realized_pnl = realized_pnl + $3,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
         WHERE user_id = $4 AND option_id = $5`,
        [newNoShares, newTotalNoCost, Math.round(realizedPnl), userId, optionId]
      );
    }
  }
}
