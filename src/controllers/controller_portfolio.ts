import { Response } from "express";
import { pool } from "../db";
import { WalletModel } from "../models/Wallet";
import { TradeModel } from "../models/Trade";
import { UserStatsModel } from "../models/UserStats";
import { sendError, sendNotFound, sendSuccess } from "../utils/errors";
import {
  GetPortfolioRequest,
  GetPositionsRequest,
  GetPnLSummaryRequest,
  GetLiquidityPositionsRequest,
} from "../types/requests";

/**
 * @route GET /api/user/portfolio
 * @desc Get user's portfolio overview
 * @access Private
 */
export const getPortfolio = async (req: GetPortfolioRequest, res: Response) => {
  try {
    const userId = req.id;

    // Get wallet balance
    const wallet = await WalletModel.findByUserId(userId);
    if (!wallet) {
      return sendNotFound(res, "Wallet");
    }

    // Get user positions across all markets
    const positionsResult = await pool.query(
      `
      SELECT 
        up.*,
        m.question as market_question,
        m.image_url as market_image,
        m.is_resolved as market_resolved,
        m.expiration_timestamp,
        mo.option_label,
        mo.option_image_url,
        mo.is_resolved as option_resolved,
        mo.winning_side
      FROM user_positions up
      LEFT JOIN markets m ON up.market_id = m.id
      LEFT JOIN market_options mo ON up.option_id = mo.id
      WHERE up.user_id = $1 AND (up.yes_shares > 0 OR up.no_shares > 0)
      ORDER BY m.expiration_timestamp ASC
    `,
      [userId]
    );

    // Get liquidity positions
    const liquidityResult = await pool.query(
      `
      SELECT 
        lp.*,
        m.question as market_question,
        m.image_url as market_image,
        m.is_resolved as market_resolved,
        m.total_shared_lp_shares,
        m.shared_pool_liquidity,
        m.accumulated_lp_fees
      FROM lp_positions lp
      LEFT JOIN markets m ON lp.market_id = m.id
      WHERE lp.user_id = $1 AND lp.shares > 0
      ORDER BY lp.created_at DESC
    `,
      [userId]
    );

    // Get user stats
    const stats = await UserStatsModel.findByUserId(userId);

    // Get trade summary
    const tradeSummary = await TradeModel.getUserTradeStats(userId);

    // Calculate portfolio summary values
    const positions = positionsResult.rows;
    const liquidityPositions = liquidityResult.rows;

    // Calculate positions value (cost basis of open positions)
    let positionsValue = 0;
    const activePositions = positions.filter((p) => !p.market_resolved);
    for (const pos of activePositions) {
      positionsValue +=
        Number(pos.total_yes_cost || 0) + Number(pos.total_no_cost || 0);
    }

    // Calculate liquidity value
    let liquidityValue = 0;
    for (const lp of liquidityPositions) {
      if (lp.market_resolved) {
        // For resolved markets, use deposited amount
        liquidityValue += Number(lp.deposited_amount || 0);
      } else {
        // For active markets, calculate current value using share value formula
        if (
          lp.total_shared_lp_shares &&
          Number(lp.total_shared_lp_shares) > 0
        ) {
          const poolLiquidity = Number(lp.shared_pool_liquidity || 0);
          const accumulatedFees = Number(lp.accumulated_lp_fees || 0);
          const totalShares = Number(lp.total_shared_lp_shares);
          const userShares = Number(lp.shares || 0);
          const shareValue = Math.floor(
            (userShares * (poolLiquidity + accumulatedFees)) / totalShares
          );
          liquidityValue += shareValue;
        } else {
          liquidityValue += Number(lp.deposited_amount || 0);
        }
      }
    }

    // Calculate total realized PnL from all positions
    let totalRealizedPnL = 0;
    for (const pos of positions) {
      totalRealizedPnL += Number(pos.realized_pnl || 0);
    }

    // Calculate total PnL (realized + unrealized)
    // Note: Unrealized PnL would require current market prices
    // For now, we'll use realized PnL only
    const totalPnL = totalRealizedPnL;
    const cashBalance = Number(wallet.balance_usdc || 0);
    const totalValue = cashBalance + positionsValue + liquidityValue;

    // Calculate total PnL percentage (based on initial investment)
    // This is a simplified calculation
    const totalPnLPercent = totalValue > 0 ? (totalPnL / totalValue) * 100 : 0;

    // Separate active and resolved positions
    const resolvedPositions = positions.filter((p) => p.market_resolved);

    return sendSuccess(res, {
      wallet: {
        public_key: wallet.public_key,
        balance_sol: wallet.balance_sol,
        balance_usdc: wallet.balance_usdc,
      },
      positions: {
        active: activePositions,
        resolved: resolvedPositions,
        total: positions.length,
      },
      liquidity: {
        positions: liquidityPositions,
        total: liquidityPositions.length,
      },
      stats: stats || {
        total_trades: tradeSummary.total_trades,
        total_volume: tradeSummary.total_volume,
        winning_trades: 0,
        losing_trades: 0,
        total_profit_loss: 0,
      },
      summary: {
        total_trades: tradeSummary.total_trades,
        buy_count: tradeSummary.buy_count,
        sell_count: tradeSummary.sell_count,
        total_volume: tradeSummary.total_volume,
      },
      // Add portfolio summary fields expected by frontend
      total_value: totalValue,
      positions_value: positionsValue,
      liquidity_value: liquidityValue,
      cash_balance: cashBalance,
      total_pnl: totalPnL,
      total_pnl_percent: totalPnLPercent,
      winning_trades: stats?.winning_trades || 0,
      losing_trades: stats?.losing_trades || 0,
    });
  } catch (error: any) {
    console.error("Get portfolio error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/user/portfolio/positions
 * @desc Get user's positions with pagination
 * @access Private
 */
export const getPositions = async (req: GetPositionsRequest, res: Response) => {
  try {
    const userId = req.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string; // 'active', 'resolved', or undefined for all

    let whereClause =
      "WHERE up.user_id = $1 AND (up.yes_shares > 0 OR up.no_shares > 0)";
    if (status === "active") {
      whereClause += " AND m.is_resolved = FALSE";
    } else if (status === "resolved") {
      whereClause += " AND m.is_resolved = TRUE";
    }

    const [positionsResult, countResult] = await Promise.all([
      pool.query(
        `
        SELECT 
          up.*,
          m.question as market_question,
          m.image_url as market_image,
          m.is_resolved as market_resolved,
          m.expiration_timestamp,
          mo.option_label,
          mo.option_image_url,
          mo.is_resolved as option_resolved,
          mo.winning_side
        FROM user_positions up
        LEFT JOIN markets m ON up.market_id = m.id
        LEFT JOIN market_options mo ON up.option_id = mo.id
        ${whereClause}
        ORDER BY m.expiration_timestamp ASC
        LIMIT $2 OFFSET $3
      `,
        [userId, limit, offset]
      ),
      pool.query(
        `
        SELECT COUNT(*)::int as count
        FROM user_positions up
        LEFT JOIN markets m ON up.market_id = m.id
        ${whereClause}
      `,
        [userId]
      ),
    ]);

    const total = countResult.rows[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    // Transform positions to match frontend interface
    const transformedPositions = positionsResult.rows.map((pos: any) => {
      const yesShares = Number(pos.yes_shares || 0);
      const noShares = Number(pos.no_shares || 0);
      const totalYesCost = Number(pos.total_yes_cost || 0);
      const totalNoCost = Number(pos.total_no_cost || 0);
      const realizedPnL = Number(pos.realized_pnl || 0);
      const isResolved = pos.option_resolved || pos.market_resolved;
      const winningSide = pos.winning_side;

      // Determine side and shares (use the side with more shares, or yes if equal)
      const side = yesShares >= noShares ? "yes" : "no";
      const shares = side === "yes" ? yesShares : noShares;
      const avgPrice =
        side === "yes"
          ? yesShares > 0
            ? totalYesCost / yesShares
            : 0
          : noShares > 0
          ? totalNoCost / noShares
          : 0;

      // For resolved positions, calculate PnL based on realized_pnl
      // For active positions, we'd need current prices (simplified for now)
      let pnl = 0;
      let currentPrice = 0.5; // Default, would need actual market prices
      let pnlPercent = 0;

      if (isResolved) {
        // Resolved position: use realized PnL
        pnl = realizedPnL;
        // Current price is 1.0 for winning side, 0.0 for losing side
        if (winningSide === 1) {
          currentPrice = side === "yes" ? 1.0 : 0.0;
        } else if (winningSide === 2) {
          currentPrice = side === "no" ? 1.0 : 0.0;
        }
      } else {
        // Active position: calculate unrealized PnL
        // Note: This is simplified - would need actual current market prices
        const costBasis = totalYesCost + totalNoCost;
        // For now, assume current value equals cost basis (no unrealized PnL)
        // This should be enhanced with actual price fetching
        pnl = 0; // Unrealized PnL would be calculated with current prices
        currentPrice = avgPrice; // Use avg price as placeholder
      }

      // Calculate PnL percentage
      const costBasis = totalYesCost + totalNoCost;
      if (costBasis > 0) {
        pnlPercent = (pnl / costBasis) * 100;
      }

      // Determine winning outcome for resolved positions
      let winningOutcome: "yes" | "no" | undefined = undefined;
      if (isResolved && winningSide) {
        winningOutcome = winningSide === 1 ? "yes" : "no";
      }

      return {
        ...pos,
        side,
        shares: shares / 1_000_000, // Convert from micro-shares to display units
        avg_price: avgPrice / 1_000_000, // Convert from micro-USDC to decimal (0-1 range)
        current_price: currentPrice,
        pnl: pnl / 1_000_000, // Convert from micro-USDC to USDC
        pnl_percent: pnlPercent,
        is_resolved: isResolved,
        winning_outcome: winningOutcome,
      };
    });

    return sendSuccess(res, {
      positions: transformedPositions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error: any) {
    console.error("Get positions error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

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
 * @route GET /api/user/portfolio/liquidity
 * @desc Get user's liquidity positions
 * @access Private
 */
export const getLiquidityPositions = async (
  req: GetLiquidityPositionsRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    const page = parseInt(req.query.page as string) || 1;
    // Remove limit or make it very high to show all positions
    const limit = parseInt(req.query.limit as string) || 1000;
    const offset = (page - 1) * limit;

    const [positionsResult, countResult] = await Promise.all([
      pool.query(
        `
        SELECT 
          lp.*,
          m.question as market_question,
          m.image_url as market_image,
          m.is_resolved as market_resolved,
          m.total_shared_lp_shares,
          m.shared_pool_liquidity,
          m.accumulated_lp_fees
        FROM lp_positions lp
        LEFT JOIN markets m ON lp.market_id = m.id
        WHERE lp.user_id = $1 AND lp.shares > 0
        ORDER BY lp.created_at DESC
        LIMIT $2 OFFSET $3
      `,
        [userId, limit, offset]
      ),
      pool.query(
        "SELECT COUNT(*)::int as count FROM lp_positions WHERE user_id = $1 AND shares > 0",
        [userId]
      ),
    ]);

    const total = countResult.rows[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    // Transform positions to match frontend interface
    const transformedPositions = positionsResult.rows.map((pos: any) => {
      const userShares = Number(pos.shares || 0);
      const depositedAmount = Number(pos.deposited_amount || 0);
      const totalShares = Number(pos.total_shared_lp_shares || 0);
      const poolLiquidity = Number(pos.shared_pool_liquidity || 0);
      const accumulatedFees = Number(pos.accumulated_lp_fees || 0);

      // Calculate current value
      let currentValue = 0;
      if (totalShares > 0) {
        currentValue = calculateShareValue(
          userShares,
          poolLiquidity,
          accumulatedFees,
          totalShares
        );
      } else {
        currentValue = depositedAmount; // Fallback to deposited amount if no shares
      }

      // Calculate fees earned (user's share of accumulated fees)
      let feesEarned = 0;
      if (totalShares > 0) {
        feesEarned = Math.floor((userShares * accumulatedFees) / totalShares);
      }

      // Calculate PnL
      const pnl = currentValue - depositedAmount;

      return {
        id: pos.id,
        market_id: pos.market_id,
        market_question: pos.market_question || "Unknown Market",
        liquidity_provided: depositedAmount, // Map deposited_amount to liquidity_provided
        fees_earned: feesEarned,
        current_value: currentValue,
        pnl: pnl,
        created_at: pos.created_at,
      };
    });

    return sendSuccess(res, {
      positions: transformedPositions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error: any) {
    console.error("Get liquidity positions error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/user/portfolio/pnl
 * @desc Get user's profit and loss summary
 * @access Private
 */
export const getPnLSummary = async (
  req: GetPnLSummaryRequest,
  res: Response
) => {
  try {
    const userId = req.id;

    // Get all completed trades for the user
    const tradesResult = await pool.query(
      `
      SELECT 
        trade_type,
        side,
        SUM(quantity) as total_quantity,
        SUM(total_cost) as total_value,
        COUNT(*) as trade_count
      FROM trades
      WHERE user_id = $1 AND status = 'completed'
      GROUP BY trade_type, side
    `,
      [userId]
    );

    // Get all positions with their realized PnL (from user_positions table)
    // This includes both resolved and unresolved positions
    const positionsResult = await pool.query(
      `
      SELECT 
        up.realized_pnl,
        up.total_yes_cost,
        up.total_no_cost,
        up.yes_shares,
        up.no_shares,
        mo.is_resolved as option_resolved,
        mo.winning_side,
        mo.option_label,
        m.question,
        m.is_resolved as market_resolved
      FROM user_positions up
      LEFT JOIN market_options mo ON up.option_id = mo.id
      LEFT JOIN markets m ON up.market_id = m.id
      WHERE up.user_id = $1
    `,
      [userId]
    );

    // Calculate realized PnL from the realized_pnl column (already calculated when positions resolved)
    let realizedPnL = 0;
    const positions = positionsResult.rows;

    for (const pos of positions) {
      // Sum up all realized PnL from the database
      realizedPnL += Number(pos.realized_pnl || 0);
    }

    // Calculate unrealized PnL from open positions
    // Note: This is a simplified calculation. For accurate unrealized PnL,
    // you'd need to fetch current market prices for each option
    let unrealizedPnL = 0;
    const openPositions = positions.filter(
      (p) =>
        !p.market_resolved &&
        (Number(p.yes_shares) > 0 || Number(p.no_shares) > 0)
    );

    // For now, unrealized PnL is set to 0 as it requires current market prices
    // This can be enhanced later with actual price fetching
    unrealizedPnL = 0;

    // Calculate best and worst trades from resolved positions
    const resolvedPositions = positions.filter((p) => p.option_resolved);
    let bestTrade: { market: string; pnl: number } | null = null;
    let worstTrade: { market: string; pnl: number } | null = null;

    for (const pos of resolvedPositions) {
      const posPnL = Number(pos.realized_pnl || 0);
      const marketName = pos.question || pos.option_label || "Unknown Market";

      if (posPnL > 0 && (!bestTrade || posPnL > bestTrade.pnl)) {
        bestTrade = { market: marketName, pnl: posPnL };
      }
      if (posPnL < 0 && (!worstTrade || posPnL < worstTrade.pnl)) {
        worstTrade = { market: marketName, pnl: posPnL };
      }
    }

    // Get user stats for comprehensive view
    const stats = await UserStatsModel.findByUserId(userId);

    return sendSuccess(res, {
      trades: tradesResult.rows,
      resolved_positions: resolvedPositions.length,
      realized_pnl: realizedPnL,
      unrealized_pnl: unrealizedPnL,
      total_pnl: realizedPnL + unrealizedPnL,
      best_trade: bestTrade,
      worst_trade: worstTrade,
      stats: stats
        ? {
            total_profit_loss: stats.total_profit_loss,
            winning_trades: stats.winning_trades,
            losing_trades: stats.losing_trades,
            win_rate:
              stats.total_trades > 0
                ? ((stats.winning_trades / stats.total_trades) * 100).toFixed(2)
                : 0,
          }
        : null,
    });
  } catch (error: any) {
    console.error("Get PnL summary error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};
