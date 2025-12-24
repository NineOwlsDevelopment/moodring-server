import { Response } from "express";
import { pool } from "../db";
import { WalletModel } from "../models/Wallet";
import { MarketModel } from "../models/Market";
import { LpPositionModel } from "../models/LpPosition";
import { ActivityModel } from "../models/Activity";
import { Connection, PublicKey } from "@solana/web3.js";
import { UUID } from "crypto";
import { emitBalanceUpdate, emitMarketUpdate } from "../services/websocket";
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
 * Uses the EXACT same algorithm as frontend:
 * - If pool is empty (totalShares === 0 || poolLiquidity === 0): shares = amount (1:1)
 * - Otherwise: shares = Math.floor((amount * totalShares) / poolLiquidity)
 *
 * Note: amount is already in micro-USDC units when passed to this function
 */
function calculateLpShares(
  amount: number,
  poolLiquidity: number,
  totalShares: number
): number {
  // Convert to BigInt for integer-only arithmetic
  const amountBigInt = BigInt(amount);
  const poolLiquidityBigInt = BigInt(poolLiquidity);
  const totalSharesBigInt = BigInt(totalShares);

  // SECURITY FIX: Minimum deposit to prevent rounding exploits
  // Minimum: 1,000,000 micro-USDC (1 USDC) to ensure at least 1 share
  const MIN_DEPOSIT = BigInt(1_000_000);
  if (amountBigInt < MIN_DEPOSIT) {
    throw new Error(
      `Minimum deposit is ${
        MIN_DEPOSIT / BigInt(1_000_000)
      } USDC to prevent rounding exploits`
    );
  }

  // If pool is empty, first LP gets 1:1 shares
  if (totalSharesBigInt === 0n || poolLiquidityBigInt === 0n) {
    // Validate minimum deposit even for first LP
    if (amountBigInt < MIN_DEPOSIT) {
      throw new Error(
        `Minimum deposit is ${MIN_DEPOSIT / BigInt(1_000_000)} USDC`
      );
    }
    return Number(amountBigInt);
  }

  // Integer-only calculation: shares = (amount * totalShares) / poolLiquidity
  // Use rounding: (amount * totalShares + poolLiquidity/2) / poolLiquidity
  // This ensures we round to nearest integer, not floor
  const numerator = amountBigInt * totalSharesBigInt;
  const halfPool = poolLiquidityBigInt / 2n;
  const roundedNumerator = numerator + halfPool;
  const sharesBigInt = roundedNumerator / poolLiquidityBigInt;

  // SECURITY FIX: Ensure at least 1 share for deposits >= MIN_DEPOSIT
  // This prevents the exploit where attacker gets 0 shares
  if (sharesBigInt === 0n && amountBigInt >= MIN_DEPOSIT) {
    // If calculation rounds to 0 but deposit is significant, give 1 share
    // This can only happen if poolLiquidity >> amount * totalShares
    // In practice, this protects against edge cases
    return 1;
  }

  // Validate shares are positive
  if (sharesBigInt < 0n) {
    throw new Error("Share calculation resulted in negative value");
  }

  return Number(sharesBigInt);
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

/**
 * Calculate total outstanding shares (liability) for an unresolved market
 * Returns the total amount of USDC that could be needed to pay out all outstanding shares
 * Each share can be redeemed for 1 micro-USDC if it wins
 */
async function calculateOutstandingLiability(
  client: any,
  marketId: string
): Promise<number> {
  // Get total outstanding shares across all options
  const sharesResult = await client.query(
    `SELECT COALESCE(SUM(yes_quantity + no_quantity), 0)::bigint as total_shares
     FROM market_options 
     WHERE market_id = $1`,
    [marketId]
  );

  return Number(sharesResult.rows[0]?.total_shares || 0);
}

/**
 * Calculate total pending claims for a resolved market
 * Returns the total amount of USDC needed to pay out all unclaimed winning positions
 */
async function calculatePendingClaims(
  client: any,
  marketId: string
): Promise<number> {
  // Get all resolved options for this market
  const optionsResult = await client.query(
    `SELECT id, winning_side 
     FROM market_options 
     WHERE market_id = $1 AND is_resolved = TRUE AND winning_side IS NOT NULL`,
    [marketId]
  );

  if (optionsResult.rows.length === 0) {
    return 0; // No resolved options, no pending claims
  }

  let totalPendingClaims = 0;

  // For each resolved option, calculate pending claims
  for (const option of optionsResult.rows) {
    const optionId = option.id;
    const winningSide = option.winning_side;

    // Get all unclaimed positions for this option
    const positionsResult = await client.query(
      `SELECT yes_shares, no_shares 
       FROM user_positions 
       WHERE option_id = $1 
         AND is_claimed = FALSE 
         AND (yes_shares > 0 OR no_shares > 0)`,
      [optionId]
    );

    // Calculate total payout needed for winners
    for (const position of positionsResult.rows) {
      const yesShares = Number(position.yes_shares || 0);
      const noShares = Number(position.no_shares || 0);

      // Payout is 1 micro-USDC per winning share
      if (winningSide === 1) {
        // YES won, so yes_shares are winning
        totalPendingClaims += yesShares;
      } else if (winningSide === 2) {
        // NO won, so no_shares are winning
        totalPendingClaims += noShares;
      }
    }
  }

  return totalPendingClaims;
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
            // SECURITY FIX: Consistent locking order - always lock Market BEFORE Wallet
            // Global locking order: Market -> Option -> Wallet -> User
            // This prevents deadlocks with trade operations

            // Get market with lock FIRST (consistent with trade operations)
            const marketResult = await client.query(
              `SELECT 
                *,
                COALESCE(shared_pool_liquidity, 0)::BIGINT as shared_pool_liquidity,
                COALESCE(total_shared_lp_shares, 0)::BIGINT as total_shared_lp_shares
               FROM markets WHERE id = $1 FOR UPDATE`,
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

            // Get user wallet with lock SECOND (consistent locking order)
            const wallet = await WalletModel.findByUserId(userId, client);

            if (!wallet) {
              throw new TransactionError(404, "Wallet not found");
            }

            // Check sufficient balance
            if (Number(wallet.balance_usdc) < parsedAmount) {
              throw new TransactionError(400, "Insufficient USDC balance");
            }
            // Get current pool state - values are COALESCE'd in query to ensure they're never NULL
            // But we still use Number() to ensure they're proper numbers
            const currentPoolLiquidity =
              Number(market.shared_pool_liquidity) || 0;
            const currentTotalShares =
              Number(market.total_shared_lp_shares) || 0;

            // Debug: Log raw values from database
            console.log("=== Raw Database Values ===");
            console.log(
              "market.shared_pool_liquidity (raw):",
              market.shared_pool_liquidity,
              typeof market.shared_pool_liquidity
            );
            console.log(
              "market.total_shared_lp_shares (raw):",
              market.total_shared_lp_shares,
              typeof market.total_shared_lp_shares
            );
            console.log(
              "currentPoolLiquidity (processed):",
              currentPoolLiquidity
            );
            console.log("currentTotalShares (processed):", currentTotalShares);

            // Calculate LP shares to mint (6 decimal precision)
            const sharesToMint = calculateLpShares(
              parsedAmount,
              currentPoolLiquidity,
              currentTotalShares
            );

            console.log("=== Add Liquidity Calculation ===");
            console.log("parsedAmount (micro-USDC):", parsedAmount);
            console.log(
              "currentPoolLiquidity (micro-USDC):",
              currentPoolLiquidity
            );
            console.log(
              "currentTotalShares (micro-units):",
              currentTotalShares
            );
            console.log("sharesToMint (micro-units):", sharesToMint);
            console.log(
              "Ratio:",
              currentTotalShares > 0 && currentPoolLiquidity > 0
                ? `${(sharesToMint / parsedAmount).toFixed(6)}:1`
                : "1:1 (first LP)"
            );
            console.log(
              "Calculation:",
              currentTotalShares > 0 && currentPoolLiquidity > 0
                ? `Math.floor((${parsedAmount} * ${currentTotalShares}) / ${currentPoolLiquidity}) = ${sharesToMint}`
                : `First LP: ${parsedAmount} (1:1)`
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
            const newLiquidity = currentPoolLiquidity + parsedAmount;
            const newTotalShares = currentTotalShares + sharesToMint;

            console.log("=== After Calculation ===");
            console.log("newLiquidity (micro-USDC):", newLiquidity);
            console.log("newTotalShares (micro-units):", newTotalShares);

            // Get total shares across all options to scale liquidity parameter
            const totalSharesResult = await client.query(
              `SELECT COALESCE(SUM(yes_quantity + no_quantity), 0)::bigint as total_shares
               FROM market_options WHERE market_id = $1`,
              [marketId]
            );
            const totalOptionShares = Number(
              totalSharesResult.rows[0]?.total_shares || 0
            );

            // Recalculate liquidity parameter (b) - scaled to match micro-unit quantities
            // Formula: b = max(base_param * 1000, sqrt(max(liquidity, total_shares)) * 10000)
            // This ensures b scales with both liquidity provision AND trading volume,
            // preventing extreme price sensitivity when markets have high share volumes
            const marketSize = Math.max(newLiquidity, totalOptionShares);
            const newLiquidityParam = Math.max(
              Number(market.base_liquidity_parameter) * 1000,
              Math.floor(Math.sqrt(marketSize) * 10000)
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

            // Verify the update was successful
            const verifyResult = await client.query(
              `SELECT shared_pool_liquidity, total_shared_lp_shares FROM markets WHERE id = $1`,
              [marketId]
            );
            const verified = verifyResult.rows[0];
            console.log("=== Verification After Update ===");
            console.log(
              "Verified shared_pool_liquidity:",
              verified?.shared_pool_liquidity
            );
            console.log(
              "Verified total_shared_lp_shares:",
              verified?.total_shared_lp_shares
            );
            console.log("Expected newLiquidity:", newLiquidity);
            console.log("Expected newTotalShares:", newTotalShares);

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
              newTotalShares,
            };
          },
          { maxRetries: 3, initialDelayMs: 100, maxDelayMs: 2000 }
        );
      }
    );

    console.log("result", result);

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

    // Emit market update via websocket
    emitMarketUpdate({
      market_id: marketId,
      event: "updated",
      data: {
        shared_pool_liquidity: result.newLiquidity,
        total_shared_lp_shares: result.newTotalShares,
        liquidity_added: parsedAmount,
        shares_minted: result.sharesToMint,
      },
      timestamp: new Date(),
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
            // SECURITY FIX: Consistent locking order - always lock Market BEFORE LP position
            // Global locking order: Market -> Option -> Wallet -> User
            // This prevents deadlocks with trade operations

            // Get market with lock FIRST (consistent with trade operations)
            const marketResult = await client.query(
              `SELECT * FROM markets WHERE id = $1 FOR UPDATE`,
              [marketId]
            );
            const market = marketResult.rows[0];

            if (!market) {
              throw new TransactionError(404, "Market not found");
            }

            // Get LP position with lock SECOND (consistent locking order)
            const positionResult = await client.query(
              `SELECT * FROM lp_positions WHERE user_id = $1 AND market_id = $2 FOR UPDATE`,
              [userId, marketId]
            );
            const position = positionResult.rows[0];

            if (!position || Number(position.shares) < parsedShares) {
              throw new TransactionError(400, "Insufficient LP shares");
            }

            // Lock LP until market is resolved
            if (!market.is_resolved) {
              throw new TransactionError(
                400,
                "Cannot remove liquidity until market is resolved. LP shares are locked until resolution."
              );
            }

            const poolLiquidity = Number(market.shared_pool_liquidity);
            const accumulatedFees = Number(market.accumulated_lp_fees);
            const totalShares = Number(market.total_shared_lp_shares);

            if (totalShares <= 0) {
              throw new TransactionError(400, "Pool has no shares");
            }

            // SECURITY FIX (CVE-002): Calculate pending claims and reserved liquidity atomically
            // This prevents race conditions where multiple withdrawals see the same "available" balance
            const pendingClaims = await calculatePendingClaims(
              client,
              marketId
            );

            // Get current reserved liquidity (atomically locked with market)
            const reservedLiquidity = Number(market.reserved_liquidity || 0);

            // SECURITY FIX (CVE-002): Available liquidity = poolLiquidity - pendingClaims - reservedLiquidity
            // Reserved liquidity is atomically updated when withdrawal starts
            const availableLiquidity = Math.max(
              0,
              poolLiquidity - pendingClaims - reservedLiquidity
            );

            // Calculate user's share ratio
            const shareRatio = parsedShares / totalShares;

            // LP can only withdraw their share of available liquidity + their share of fees
            const liquidityPortion = Math.floor(
              availableLiquidity * shareRatio
            );
            const feesPortion = Math.floor(accumulatedFees * shareRatio);
            const usdcToReturn = liquidityPortion + feesPortion;

            // SECURITY FIX (CVE-002): Atomically reserve liquidity before withdrawal
            // This prevents concurrent withdrawals from seeing the same available balance
            const newReservedLiquidity = reservedLiquidity + liquidityPortion;

            // Validate we're not reserving more than available
            if (newReservedLiquidity > poolLiquidity - pendingClaims) {
              throw new TransactionError(
                400,
                "Insufficient available liquidity. Another withdrawal may be in progress."
              );
            }

            // Update reserved liquidity atomically
            await client.query(
              `UPDATE markets SET reserved_liquidity = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`,
              [newReservedLiquidity, marketId]
            );

            if (usdcToReturn <= 0) {
              throw new TransactionError(
                400,
                "No claimable amount available. All liquidity is reserved for pending trader claims."
              );
            }

            // Safety check: ensure we're not withdrawing more liquidity than available
            if (liquidityPortion > availableLiquidity) {
              throw new TransactionError(
                400,
                `Invalid withdrawal: requested ${(
                  liquidityPortion / 1_000_000
                ).toFixed(2)} USDC from pool but only ${(
                  availableLiquidity / 1_000_000
                ).toFixed(2)} USDC available.`
              );
            }

            // Safety check: ensure we're not claiming more fees than exist
            if (feesPortion > accumulatedFees) {
              throw new TransactionError(
                400,
                `Invalid fees claim: requested ${(
                  feesPortion / 1_000_000
                ).toFixed(2)} USDC in fees but only ${(
                  accumulatedFees / 1_000_000
                ).toFixed(2)} USDC available.`
              );
            }

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

            // SECURITY FIX (CVE-002): Release reserved liquidity after withdrawal completes
            const finalReservedLiquidity = Math.max(
              0,
              newReservedLiquidity - liquidityPortion
            );

            // Get total shares across all options to scale liquidity parameter
            const totalSharesResult = await client.query(
              `SELECT COALESCE(SUM(yes_quantity + no_quantity), 0)::bigint as total_shares
               FROM market_options WHERE market_id = $1`,
              [marketId]
            );
            const totalOptionShares = Number(
              totalSharesResult.rows[0]?.total_shares || 0
            );

            // Recalculate liquidity parameter - scaled to match micro-unit quantities
            // Formula: b = max(base_param * 1000, sqrt(max(liquidity, total_shares)) * 10000)
            // This ensures b scales with both liquidity provision AND trading volume
            const newLiquidityParam =
              newPoolLiquidity > 0
                ? (() => {
                    const marketSize = Math.max(
                      newPoolLiquidity,
                      totalOptionShares
                    );
                    return Math.max(
                      Number(market.base_liquidity_parameter) * 1000,
                      Math.floor(Math.sqrt(marketSize) * 10000)
                    );
                  })()
                : Number(market.base_liquidity_parameter) * 1000;

            // SECURITY FIX (CVE-002): Update reserved liquidity along with pool liquidity
            await client.query(
              `UPDATE markets SET 
          shared_pool_liquidity = $1,
          total_shared_lp_shares = $2,
          accumulated_lp_fees = $3,
          liquidity_parameter = $4,
          reserved_liquidity = $5,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
         WHERE id = $6`,
              [
                newPoolLiquidity,
                newTotalShares,
                newAccumulatedFees,
                newLiquidityParam,
                finalReservedLiquidity,
                marketId,
              ]
            );

            // Credit user wallet
            await client.query(
              `UPDATE wallets SET balance_usdc = balance_usdc + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE user_id = $2`,
              [usdcToReturn, userId]
            );

            return {
              usdcToReturn,
              feesPortion,
              newPoolLiquidity,
              newTotalShares,
              newAccumulatedFees,
            };
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

    // Emit market update via websocket
    emitMarketUpdate({
      market_id: marketId,
      event: "updated",
      data: {
        shared_pool_liquidity: result.newPoolLiquidity,
        total_shared_lp_shares: result.newTotalShares,
        accumulated_lp_fees: result.newAccumulatedFees,
        liquidity_removed: parsedShares,
        usdc_returned: result.usdcToReturn,
      },
      timestamp: new Date(),
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
          claimable_value: 0,
          pnl: 0,
        },
      });
    }

    // Calculate current value
    const marketData = await MarketModel.findById(market);
    let currentValue = 0;
    let claimableValue = 0;

    if (marketData && Number(marketData.total_shared_lp_shares) > 0) {
      const poolLiquidity = Number(marketData.shared_pool_liquidity);
      const accumulatedFees = Number(marketData.accumulated_lp_fees);
      const totalShares = Number(marketData.total_shared_lp_shares);
      const userShares = Number(position.shares);

      // Calculate full current value (what user's shares are worth)
      currentValue = calculateShareValue(
        userShares,
        poolLiquidity,
        accumulatedFees,
        totalShares
      );

      // For resolved markets, calculate claimable amount accounting for pending claims
      // LP can only claim from available pool (after reserving for pending trader claims)
      if (marketData.is_resolved) {
        const client = await pool.connect();
        try {
          const pendingClaims = await calculatePendingClaims(client, market);

          // Available liquidity = poolLiquidity - pendingClaims (reserved for traders)
          const availableLiquidity = Math.max(0, poolLiquidity - pendingClaims);

          // Calculate user's share ratio
          const shareRatio = userShares / totalShares;

          // LP can claim their share of available liquidity + their share of fees
          const claimableLiquidityPortion = Math.floor(
            availableLiquidity * shareRatio
          );
          const feesPortion = Math.floor(accumulatedFees * shareRatio);
          claimableValue = claimableLiquidityPortion + feesPortion;
        } finally {
          client.release();
        }
      } else {
        // For unresolved markets, LP is locked - cannot withdraw until market resolves
        claimableValue = 0;
      }
    }

    return sendSuccess(res, {
      position: {
        ...position,
        shares: Number(position.shares),
        deposited_amount: Number(position.deposited_amount),
        current_value: currentValue,
        claimable_value: claimableValue,
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
            // SECURITY FIX: Consistent locking order - always lock Market BEFORE LP position
            // Global locking order: Market -> Option -> Wallet -> User
            // This prevents deadlocks with trade operations

            // Get market with lock FIRST (consistent with trade operations)
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

            // Get LP position with lock SECOND (consistent locking order)
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

            // SECURITY FIX (CVE-002): Calculate pending claims and reserved liquidity atomically
            const pendingClaims = await calculatePendingClaims(
              client,
              marketId
            );

            // Get current reserved liquidity (atomically locked with market)
            const reservedLiquidity = Number(market.reserved_liquidity || 0);

            // SECURITY FIX (CVE-002): Available liquidity = poolLiquidity - pendingClaims - reservedLiquidity
            const availableLiquidity = Math.max(
              0,
              poolLiquidity - pendingClaims - reservedLiquidity
            );

            // Calculate proportional payout based on available pool + fees
            // LP can claim their share of (availableLiquidity + accumulatedFees)
            const shareRatio = sharesToClaim / totalShares;
            const liquidityPortion = Math.floor(
              availableLiquidity * shareRatio
            );
            const feesPortion = Math.floor(accumulatedFees * shareRatio);
            const payout = liquidityPortion + feesPortion;

            // SECURITY FIX (CVE-002): Atomically reserve liquidity before withdrawal
            const newReservedLiquidity = reservedLiquidity + liquidityPortion;

            // Validate we're not reserving more than available
            if (newReservedLiquidity > poolLiquidity - pendingClaims) {
              throw new TransactionError(
                400,
                "Insufficient available liquidity. Another withdrawal may be in progress."
              );
            }

            // Update reserved liquidity atomically
            await client.query(
              `UPDATE markets SET reserved_liquidity = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`,
              [newReservedLiquidity, marketId]
            );

            // Validate that we have enough funds to cover the payout
            const totalAvailable = availableLiquidity + accumulatedFees;
            const maxPayout = Math.floor(totalAvailable * shareRatio);

            if (payout <= 0) {
              throw new TransactionError(
                400,
                "No claimable amount available. All liquidity is reserved for pending trader claims."
              );
            }

            // Safety check: payout should never exceed what's actually available
            if (payout > maxPayout) {
              throw new TransactionError(
                400,
                `Invalid claim amount: requested ${(payout / 1_000_000).toFixed(
                  2
                )} USDC but only ${(maxPayout / 1_000_000).toFixed(
                  2
                )} USDC available.`
              );
            }

            // Additional safety: ensure we're not claiming more liquidity than exists
            if (liquidityPortion > availableLiquidity) {
              throw new TransactionError(
                400,
                `Invalid liquidity claim: requested ${(
                  liquidityPortion / 1_000_000
                ).toFixed(2)} USDC from pool but only ${(
                  availableLiquidity / 1_000_000
                ).toFixed(2)} USDC available.`
              );
            }

            // Ensure we're not claiming more fees than exist
            if (feesPortion > accumulatedFees) {
              throw new TransactionError(
                400,
                `Invalid fees claim: requested ${(
                  feesPortion / 1_000_000
                ).toFixed(2)} USDC in fees but only ${(
                  accumulatedFees / 1_000_000
                ).toFixed(2)} USDC available.`
              );
            }

            // Calculate breakdown
            const proportionalDeposit = Math.floor(
              (depositedAmount * sharesToClaim) / userShares
            );
            const pnl = payout - proportionalDeposit;

            // Calculate new pool liquidity after withdrawal
            const newPoolLiquidity = Math.max(
              0,
              poolLiquidity - liquidityPortion
            );

            // SECURITY FIX (CVE-002): Release reserved liquidity after withdrawal completes
            const finalReservedLiquidity = Math.max(
              0,
              newReservedLiquidity - liquidityPortion
            );

            // Double-check that we're not leaving insufficient liquidity for pending claims
            // This should never happen with the new calculation, but keep as safety check
            if (newPoolLiquidity < pendingClaims) {
              const pendingClaimsFormatted = (
                pendingClaims / 1_000_000
              ).toFixed(2);
              const remainingFormatted = (newPoolLiquidity / 1_000_000).toFixed(
                2
              );
              throw new TransactionError(
                400,
                `Cannot claim LP rewards: ${pendingClaimsFormatted} USDC needed for pending claims, but only ${remainingFormatted} USDC would remain after withdrawal. Please wait until all claims are processed.`
              );
            }

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
            // newPoolLiquidity already calculated above for pending claims check
            const newAccumulatedFees = Math.max(
              0,
              accumulatedFees - feesPortion
            );
            const newTotalShares = Math.max(0, totalShares - sharesToClaim);

            // SECURITY FIX (CVE-002): Update reserved liquidity along with pool liquidity
            await client.query(
              `UPDATE markets SET 
          shared_pool_liquidity = $1,
          total_shared_lp_shares = $2,
          accumulated_lp_fees = $3,
          reserved_liquidity = $4,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
         WHERE id = $5`,
              [
                newPoolLiquidity,
                newTotalShares,
                newAccumulatedFees,
                finalReservedLiquidity,
                marketId,
              ]
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
