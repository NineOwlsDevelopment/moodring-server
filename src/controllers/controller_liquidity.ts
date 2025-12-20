import { Response } from "express";
import { pool } from "../db";
import { WalletModel } from "../models/Wallet";
import { MarketModel } from "../models/Market";
import { LpPositionModel } from "../models/LpPosition";
import { ActivityModel } from "../models/Activity";
import { Connection, PublicKey } from "@solana/web3.js";
import { UUID } from "crypto";
import { emitBalanceUpdate } from "../services/websocket";
import { withTransaction, TransactionError } from "../utils/transaction";
import { withTradeQueue } from "../services/tradeQueue";
import {
  sendError,
  sendNotFound,
  sendSuccess,
  sendValidationError,
} from "../utils/errors";
import { validateRequired, validateNumber } from "../utils/validation";
import {
  AddLiquidityRequest,
  RemoveLiquidityRequest,
  GetLpPositionRequest,
  GetAllLpPositionsRequest,
  CalculateLpShareValueRequest,
  ClaimLpRewardsRequest,
  GetLpTokenBalanceRequest,
} from "../types/requests";

/**
 * Calculate LP shares for a given deposit amount
 * If pool is empty, shares = amount (1:1)
 * Otherwise, shares = (amount / total_pool_value) * total_shares
 */
function calculateLpShares(
  amount: number,
  poolLiquidity: number,
  totalShares: number
): number {
  if (totalShares === 0 || poolLiquidity === 0) {
    return amount; // First LP gets 1:1 shares
  }
  return Math.floor((amount * totalShares) / poolLiquidity);
}

/**
 * Calculate the USDC value of LP shares
 */
function calculateShareValue(
  shares: number,
  poolLiquidity: number,
  accumulatedFees: number,
  totalShares: number
): number {
  if (totalShares === 0) return 0;
  return Math.floor((shares * (poolLiquidity + accumulatedFees)) / totalShares);
}

// Solana connection for LP token balance queries
const getConnection = () => {
  const rpcUrl = process.env.RPC_URL || "https://api.devnet.solana.com";
  return new Connection(rpcUrl, "confirmed");
};

/**
 * @route POST /api/liquidity/add
 * @desc Add liquidity to a market
 * @access Private
 */
export const addLiquidity = async (req: AddLiquidityRequest, res: Response) => {
  try {
    const userId = req.id;
    const { market: marketId, amount } = req.body;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    // Validate required fields
    if (!validateRequired(marketId, "Market ID").isValid) {
      return sendValidationError(res, "Market ID is required");
    }

    const amountValidation = validateNumber(
      amount,
      "Amount",
      0.000001,
      undefined
    );
    if (!amountValidation.isValid) {
      return sendValidationError(res, amountValidation.error!);
    }

    const parsedAmount = Number(amount);

    // Queue the liquidity operation to prevent deadlocks
    const result = await withTradeQueue(
      marketId as UUID,
      undefined,
      async () => {
        return await withTransaction(
          async (client) => {
            // Get user wallet with lock
            const wallet = await WalletModel.findByUserId(userId, client);

            if (!wallet) {
              throw new TransactionError(404, "Wallet not found");
            }

            // Check sufficient balance
            if (Number(wallet.balance_usdc) < parsedAmount) {
              throw new TransactionError(400, "Insufficient USDC balance");
            }

            // Get market with lock
            const marketResult = await client.query(
              `SELECT * FROM markets WHERE id = $1 FOR UPDATE`,
              [marketId]
            );
            const market = marketResult.rows[0];

            if (!market) {
              throw new TransactionError(404, "Market not found");
            }

            if (market.is_resolved) {
              throw new TransactionError(
                400,
                "Cannot add liquidity to resolved market"
              );
            }

            if (!market.is_initialized) {
              throw new TransactionError(400, "Market is not initialized");
            }

            // Calculate LP shares to mint (6 decimal precision)
            const sharesToMint = calculateLpShares(
              parsedAmount,
              Number(market.shared_pool_liquidity),
              Number(market.total_shared_lp_shares)
            );

            if (sharesToMint <= 0) {
              throw new TransactionError(
                400,
                "Amount too small to mint shares"
              );
            }

            // Deduct from user wallet
            await client.query(
              `UPDATE wallets SET balance_usdc = balance_usdc - $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`,
              [parsedAmount, wallet.id]
            );

            // Update market liquidity pool
            const newLiquidity =
              Number(market.shared_pool_liquidity) + parsedAmount;
            const newTotalShares =
              Number(market.total_shared_lp_shares) + sharesToMint;

            // Recalculate liquidity parameter (b) - scaled to match micro-unit quantities
            // Using formula: b = max(base_param * 1000, sqrt(liquidity) * 10000)
            const newLiquidityParam = Math.max(
              Number(market.base_liquidity_parameter) * 1000,
              Math.floor(Math.sqrt(newLiquidity) * 10000)
            );

            await client.query(
              `UPDATE markets SET 
          shared_pool_liquidity = $1,
          total_shared_lp_shares = $2,
          liquidity_parameter = $3,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
         WHERE id = $4`,
              [newLiquidity, newTotalShares, newLiquidityParam, marketId]
            );

            // Create/update LP position with token balance using model
            await LpPositionModel.create(
              {
                user_id: userId,
                market_id: marketId,
                shares: sharesToMint,
                deposited_amount: parsedAmount,
                lp_token_balance: sharesToMint,
              },
              client
            );

            return {
              sharesToMint,
              newLiquidity,
            };
          },
          { maxRetries: 3, initialDelayMs: 100, maxDelayMs: 2000 }
        );
      }
    );

    // Record activity
    await ActivityModel.create({
      user_id: userId as UUID,
      activity_type: "liquidity_added",
      entity_type: "market",
      entity_id: marketId,
      metadata: {
        amount: parsedAmount,
        shares_minted: result.sharesToMint,
        market_id: marketId,
      },
    });

    return sendSuccess(res, {
      message: "Liquidity added successfully",
      shares_minted: result.sharesToMint,
      amount_deposited: parsedAmount,
      new_pool_liquidity: result.newLiquidity,
    });
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return sendError(res, error.statusCode, error.message, error.details);
    }
    console.error("Add liquidity error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route POST /api/liquidity/remove
 * @desc Remove liquidity from a market
 * @access Private
 */
export const removeLiquidity = async (
  req: RemoveLiquidityRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    const { market: marketId, shares } = req.body;

    // Validate required fields
    if (!validateRequired(marketId, "Market ID").isValid) {
      return sendValidationError(res, "Market ID is required");
    }

    const sharesValidation = validateNumber(
      shares,
      "Shares",
      0.000001,
      undefined
    );
    if (!sharesValidation.isValid) {
      return sendValidationError(res, sharesValidation.error!);
    }

    const parsedShares = Number(shares);

    // Queue the liquidity operation to prevent deadlocks
    const result = await withTradeQueue(
      marketId as UUID,
      undefined,
      async () => {
        return await withTransaction(
          async (client) => {
            // Get LP position with lock
            const positionResult = await client.query(
              `SELECT * FROM lp_positions WHERE user_id = $1 AND market_id = $2 FOR UPDATE`,
              [userId, marketId]
            );
            const position = positionResult.rows[0];

            if (!position || Number(position.shares) < parsedShares) {
              throw new TransactionError(400, "Insufficient LP shares");
            }

            // Get market with lock
            const marketResult = await client.query(
              `SELECT * FROM markets WHERE id = $1 FOR UPDATE`,
              [marketId]
            );
            const market = marketResult.rows[0];

            if (!market) {
              throw new TransactionError(404, "Market not found");
            }

            const poolLiquidity = Number(market.shared_pool_liquidity);
            const accumulatedFees = Number(market.accumulated_lp_fees);
            const totalShares = Number(market.total_shared_lp_shares);

            // Calculate USDC to return (includes proportional share of accumulated fees)
            const usdcToReturn = calculateShareValue(
              parsedShares,
              poolLiquidity,
              accumulatedFees,
              totalShares
            );

            if (usdcToReturn <= 0) {
              throw new TransactionError(
                400,
                "Share value too low to withdraw"
              );
            }

            // Calculate how much comes from liquidity vs fees
            const shareRatio = parsedShares / totalShares;
            const liquidityPortion = Math.floor(poolLiquidity * shareRatio);
            const feesPortion = Math.floor(accumulatedFees * shareRatio);

            // Update LP position
            const newShares = Number(position.shares) - parsedShares;
            // Use BigInt for precision: (deposited_amount * newShares) / shares
            const newDepositedAmount = Number(
              (BigInt(position.deposited_amount) * BigInt(newShares)) /
                BigInt(position.shares)
            );
            const newTokenBalance = Math.max(
              0,
              Number(position.lp_token_balance || 0) - parsedShares
            );

            if (newShares <= 0) {
              await client.query(
                `DELETE FROM lp_positions WHERE user_id = $1 AND market_id = $2`,
                [userId, marketId]
              );
            } else {
              await client.query(
                `UPDATE lp_positions 
           SET shares = $3, deposited_amount = $4, lp_token_balance = $5, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
           WHERE user_id = $1 AND market_id = $2`,
                [
                  userId,
                  marketId,
                  newShares,
                  newDepositedAmount,
                  newTokenBalance,
                ]
              );
            }

            // Update market
            const newPoolLiquidity = poolLiquidity - liquidityPortion;
            const newAccumulatedFees = Math.max(
              0,
              accumulatedFees - feesPortion
            );
            const newTotalShares = totalShares - parsedShares;

            // Recalculate liquidity parameter - scaled to match micro-unit quantities
            const newLiquidityParam =
              newPoolLiquidity > 0
                ? Math.max(
                    Number(market.base_liquidity_parameter) * 1000,
                    Math.floor(Math.sqrt(newPoolLiquidity) * 10000)
                  )
                : Number(market.base_liquidity_parameter) * 1000;

            await client.query(
              `UPDATE markets SET 
          shared_pool_liquidity = $1,
          total_shared_lp_shares = $2,
          accumulated_lp_fees = $3,
          liquidity_parameter = $4,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
         WHERE id = $5`,
              [
                newPoolLiquidity,
                newTotalShares,
                newAccumulatedFees,
                newLiquidityParam,
                marketId,
              ]
            );

            // Credit user wallet
            await client.query(
              `UPDATE wallets SET balance_usdc = balance_usdc + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE user_id = $2`,
              [usdcToReturn, userId]
            );

            return { usdcToReturn, feesPortion };
          },
          { maxRetries: 3, initialDelayMs: 100, maxDelayMs: 2000 }
        );
      }
    );

    // Record activity
    await ActivityModel.create({
      user_id: userId as UUID,
      activity_type: "liquidity_removed",
      entity_type: "market",
      entity_id: marketId,
      metadata: {
        shares_burned: parsedShares,
        usdc_returned: result.usdcToReturn,
        fees_portion: result.feesPortion,
        market_id: marketId,
      },
    });

    return sendSuccess(res, {
      message: "Liquidity removed successfully",
      shares_burned: parsedShares,
      usdc_returned: result.usdcToReturn,
      fees_earned: result.feesPortion,
    });
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return sendError(res, error.statusCode, error.message, error.details);
    }
    console.error("Remove liquidity error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/liquidity/position/:market
 * @desc Get user's LP position for a market
 * @access Private
 */
export const getLpPosition = async (
  req: GetLpPositionRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    const { market } = req.params;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    if (!validateRequired(market, "Market ID").isValid) {
      return sendValidationError(res, "Market ID is required");
    }

    const position = await LpPositionModel.findByUserAndMarket(userId, market);

    if (!position) {
      return sendSuccess(res, {
        position: {
          shares: 0,
          deposited_amount: 0,
          current_value: 0,
          pnl: 0,
        },
      });
    }

    // Calculate current value
    const marketData = await MarketModel.findById(market);
    let currentValue = 0;
    if (marketData && Number(marketData.total_shared_lp_shares) > 0) {
      currentValue = calculateShareValue(
        Number(position.shares),
        Number(marketData.shared_pool_liquidity),
        Number(marketData.accumulated_lp_fees),
        Number(marketData.total_shared_lp_shares)
      );
    }

    return sendSuccess(res, {
      position: {
        ...position,
        shares: Number(position.shares),
        deposited_amount: Number(position.deposited_amount),
        current_value: currentValue,
        pnl: currentValue - Number(position.deposited_amount),
      },
    });
  } catch (error: any) {
    console.error("Get LP position error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/liquidity/positions
 * @desc Get all LP positions for a user
 * @access Private
 */
export const getAllLpPositions = async (
  req: GetAllLpPositionsRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    const positions = await LpPositionModel.findByUser(userId);

    // Get market data for all positions
    const marketIds = positions.map((p) => p.market_id);
    const marketsResult = await pool.query(
      `SELECT id, question, shared_pool_liquidity, accumulated_lp_fees, total_shared_lp_shares, is_resolved
       FROM markets WHERE id = ANY($1::uuid[])`,
      [marketIds]
    );

    const marketMap = new Map(marketsResult.rows.map((m) => [m.id, m]));

    const positionsWithValue = positions.map((position) => {
      const market = marketMap.get(position.market_id);
      let currentValue = 0;
      if (market && Number(market.total_shared_lp_shares) > 0) {
        currentValue = calculateShareValue(
          Number(position.shares),
          Number(market.shared_pool_liquidity),
          Number(market.accumulated_lp_fees),
          Number(market.total_shared_lp_shares)
        );
      }

      return {
        ...position,
        shares: Number(position.shares),
        deposited_amount: Number(position.deposited_amount),
        current_value: currentValue,
        pnl: currentValue - Number(position.deposited_amount),
        market_question: market?.question || "Unknown",
        market_resolved: market?.is_resolved || false,
      };
    });

    return sendSuccess(res, { positions: positionsWithValue });
  } catch (error: any) {
    console.error("Get all LP positions error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/liquidity/share-value/:market
 * @desc Get the current value per LP share for a market
 * @access Public
 */
export const calculateLpShareValue = async (
  req: CalculateLpShareValueRequest,
  res: Response
) => {
  try {
    const { market } = req.params;

    if (!validateRequired(market, "Market ID").isValid) {
      return sendValidationError(res, "Market ID is required");
    }

    const marketData = await MarketModel.findById(market);
    if (!marketData) {
      return sendNotFound(res, "Market");
    }

    const totalPoolValue =
      Number(marketData.shared_pool_liquidity) +
      Number(marketData.accumulated_lp_fees);
    const totalShares = Number(marketData.total_shared_lp_shares);

    const valuePerShare = totalShares > 0 ? totalPoolValue / totalShares : 1;

    const lpCount = await LpPositionModel.getMarketLpCount(market);

    return sendSuccess(res, {
      value_per_share: valuePerShare,
      total_pool_value: totalPoolValue,
      total_shares: totalShares,
      pool_liquidity: Number(marketData.shared_pool_liquidity),
      accumulated_fees: Number(marketData.accumulated_lp_fees),
      lp_count: lpCount,
      lp_token_mint: (marketData as any).lp_token_mint || null,
    });
  } catch (error: any) {
    console.error("Calculate LP share value error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route POST /api/liquidity/claim
 * @desc Claim LP rewards after market resolution by spending (burning) LP tokens
 * @access Private
 */
export const claimLpRewards = async (
  req: ClaimLpRewardsRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    const { market: marketId, shares: requestedShares } = req.body;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    if (!validateRequired(marketId, "Market ID").isValid) {
      return sendValidationError(res, "Market ID is required");
    }

    // Queue the liquidity operation to prevent deadlocks
    const result = await withTradeQueue(
      marketId as UUID,
      undefined,
      async () => {
        return await withTransaction(
          async (client) => {
            // Get market with lock
            const marketResult = await client.query(
              `SELECT * FROM markets WHERE id = $1 FOR UPDATE`,
              [marketId]
            );
            const market = marketResult.rows[0];

            if (!market) {
              throw new TransactionError(404, "Market not found");
            }

            // Market must be resolved to claim LP rewards
            if (!market.is_resolved) {
              throw new TransactionError(
                400,
                "Market is not resolved. Use /remove endpoint for early withdrawal."
              );
            }

            // Get LP position with lock
            const positionResult = await client.query(
              `SELECT * FROM lp_positions WHERE user_id = $1 AND market_id = $2 FOR UPDATE`,
              [userId, marketId]
            );
            const position = positionResult.rows[0];

            if (!position || Number(position.shares) <= 0) {
              throw new TransactionError(400, "No LP shares to claim");
            }

            // Determine shares to claim (all shares if not specified)
            const userShares = Number(position.shares);
            const sharesToClaim = requestedShares
              ? Math.min(Number(requestedShares), userShares)
              : userShares;

            if (sharesToClaim <= 0) {
              throw new TransactionError(400, "Invalid share amount");
            }

            const depositedAmount = Number(position.deposited_amount);
            const lpTokenBalance = Number(position.lp_token_balance || 0);
            const poolLiquidity = Number(market.shared_pool_liquidity);
            const accumulatedFees = Number(market.accumulated_lp_fees);
            const totalShares = Number(market.total_shared_lp_shares);

            if (totalShares <= 0) {
              throw new TransactionError(400, "Pool has no shares");
            }

            // Calculate proportional payout (liquidity + fees)
            // Value per share = (poolLiquidity + accumulatedFees) / totalShares
            // Payout = sharesToClaim * valuePerShare
            const totalPoolValue = poolLiquidity + accumulatedFees;
            const payout = Math.floor(
              (sharesToClaim * totalPoolValue) / totalShares
            );

            if (payout <= 0) {
              throw new TransactionError(400, "Calculated payout is zero");
            }

            // Calculate breakdown
            const shareRatio = sharesToClaim / totalShares;
            const liquidityPortion = Math.floor(poolLiquidity * shareRatio);
            const feesPortion = Math.floor(accumulatedFees * shareRatio);
            const proportionalDeposit = Math.floor(
              (depositedAmount * sharesToClaim) / userShares
            );
            const pnl = payout - proportionalDeposit;

            // Update LP position
            const remainingShares = userShares - sharesToClaim;
            const remainingDeposit = depositedAmount - proportionalDeposit;
            const remainingTokenBalance = Math.max(
              0,
              lpTokenBalance - sharesToClaim
            );

            if (remainingShares <= 0) {
              // Delete position if all shares claimed
              await client.query(
                `DELETE FROM lp_positions WHERE user_id = $1 AND market_id = $2`,
                [userId, marketId]
              );
            } else {
              // Update position with remaining shares
              await client.query(
                `UPDATE lp_positions 
           SET shares = $3, 
               deposited_amount = $4, 
               lp_token_balance = $5,
               updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
           WHERE user_id = $1 AND market_id = $2`,
                [
                  userId,
                  marketId,
                  remainingShares,
                  remainingDeposit,
                  remainingTokenBalance,
                ]
              );
            }

            // Update market pool values
            const newPoolLiquidity = Math.max(
              0,
              poolLiquidity - liquidityPortion
            );
            const newAccumulatedFees = Math.max(
              0,
              accumulatedFees - feesPortion
            );
            const newTotalShares = Math.max(0, totalShares - sharesToClaim);

            await client.query(
              `UPDATE markets SET 
          shared_pool_liquidity = $1,
          total_shared_lp_shares = $2,
          accumulated_lp_fees = $3,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
         WHERE id = $4`,
              [newPoolLiquidity, newTotalShares, newAccumulatedFees, marketId]
            );

            // Credit user wallet
            await client.query(
              `UPDATE wallets SET balance_usdc = balance_usdc + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE user_id = $2`,
              [payout, userId]
            );

            // Get updated balance for websocket update
            const updatedWalletResult = await client.query(
              `SELECT balance_usdc FROM wallets WHERE user_id = $1`,
              [userId]
            );
            const newBalance = updatedWalletResult.rows[0]?.balance_usdc || 0;

            return {
              sharesToClaim,
              payout,
              liquidityPortion,
              feesPortion,
              proportionalDeposit,
              pnl,
              remainingShares,
              newBalance,
            };
          },
          { maxRetries: 3, initialDelayMs: 100, maxDelayMs: 2000 }
        );
      }
    );

    // Emit balance update via websocket
    try {
      emitBalanceUpdate({
        user_id: userId,
        balance_usdc: result.newBalance,
        timestamp: new Date(),
      });
    } catch (wsError) {
      // Don't fail the claim if websocket emission fails
      console.error("WebSocket emission error:", wsError);
    }

    // Record activity
    await ActivityModel.create({
      user_id: userId as UUID,
      activity_type: "lp_rewards_claimed",
      entity_type: "market",
      entity_id: marketId,
      metadata: {
        shares_burned: result.sharesToClaim,
        usdc_payout: result.payout,
        liquidity_portion: result.liquidityPortion,
        fees_earned: result.feesPortion,
        pnl: result.pnl,
        market_id: marketId,
      },
    });

    return sendSuccess(res, {
      message: "LP rewards claimed successfully",
      shares_burned: result.sharesToClaim,
      payout: result.payout,
      breakdown: {
        liquidity_returned: result.liquidityPortion,
        fees_earned: result.feesPortion,
        original_deposit: result.proportionalDeposit,
        pnl: result.pnl,
      },
      remaining_shares: result.remainingShares,
    });
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return sendError(res, error.statusCode, error.message, error.details);
    }
    console.error("Claim LP rewards error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};
