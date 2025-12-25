"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonTradeOperations = void 0;
const transaction_1 = require("../utils/transaction");
const tradeUtils_1 = require("../utils/tradeUtils");
/**
 * SECURITY: Global Database Locking Order
 *
 * To prevent deadlocks, ALL database operations MUST acquire locks in this order:
 * 1. Market (markets table)
 * 2. Option (market_options table)
 * 3. Wallet (wallets table)
 * 4. User/Position (user_positions, lp_positions tables)
 *
 * This ensures consistent lock ordering across all code paths:
 * - Trade operations: Market -> Option -> Wallet
 * - Liquidity operations: Market -> Wallet (or Market -> LP Position)
 * - Withdrawal operations: Wallet (only)
 *
 * Violating this order can cause deadlocks when operations run concurrently.
 */
class CommonTradeOperations {
    /**
     * Get market with lock (first in consistent ordering)
     * SECURITY: Always lock Market FIRST to prevent deadlocks
     */
    static async getMarketWithLock(client, marketId) {
        const marketResult = await client.query(`SELECT * FROM markets WHERE id = $1 FOR UPDATE`, [marketId]);
        const marketData = marketResult.rows[0];
        if (!marketData) {
            throw new transaction_1.TransactionError(404, "Market not found");
        }
        if (marketData.is_resolved) {
            throw new transaction_1.TransactionError(400, "Market is already resolved");
        }
        if (!marketData.is_initialized) {
            throw new transaction_1.TransactionError(400, "Market is not initialized");
        }
        return marketData;
    }
    /**
     * Get option with lock (second in consistent ordering)
     * SECURITY: Always lock Option AFTER Market to prevent deadlocks
     */
    static async getOptionWithLock(client, optionId) {
        const optionResult = await client.query(`SELECT * FROM market_options WHERE id = $1 FOR UPDATE`, [optionId]);
        const optionData = optionResult.rows[0];
        if (!optionData) {
            throw new transaction_1.TransactionError(404, "Option not found");
        }
        // Validate option resolution status (for trades, option shouldn't be resolved)
        if (optionData.is_resolved) {
            throw new transaction_1.TransactionError(400, "Option is already resolved");
        }
        return optionData;
    }
    /**
     * Get option without lock (for read operations)
     */
    static async getOption(client, optionId) {
        const optionResult = await client.query(`SELECT * FROM market_options WHERE id = $1`, [optionId]);
        const optionData = optionResult.rows[0];
        if (!optionData) {
            throw new transaction_1.TransactionError(404, "Option not found");
        }
        return optionData;
    }
    /**
     * Get wallet with lock (third in consistent ordering)
     * SECURITY: Always lock Wallet AFTER Market/Option to prevent deadlocks
     */
    static async getWalletWithLock(client, userId) {
        const walletResult = await client.query(`SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`, [userId]);
        const wallet = walletResult.rows[0];
        if (!wallet) {
            throw new transaction_1.TransactionError(404, "Wallet not found");
        }
        return wallet;
    }
    /**
     * Get user position with lock
     */
    static async getUserPositionWithLock(client, userId, optionId) {
        const positionResult = await client.query(`SELECT * FROM user_positions WHERE user_id = $1 AND option_id = $2 FOR UPDATE`, [userId, optionId]);
        return positionResult.rows[0] || null;
    }
    /**
     * Check sufficient shares for sell operation
     */
    static checkSufficientShares(position, sellYes, sellNo) {
        if (!position) {
            throw new transaction_1.TransactionError(404, "No position found for this option");
        }
        if (sellYes > Number(position.yes_shares)) {
            throw new transaction_1.TransactionError(400, "Insufficient YES shares");
        }
        if (sellNo > Number(position.no_shares)) {
            throw new transaction_1.TransactionError(400, "Insufficient NO shares");
        }
    }
    /**
     * Check wallet balance
     */
    static checkWalletBalance(wallet, requiredAmount) {
        if (wallet.balance_usdc < requiredAmount) {
            throw new transaction_1.TransactionError(400, "Insufficient USDC balance");
        }
    }
    /**
     * Check shared pool liquidity for payouts
     */
    static checkPoolLiquidity(marketData, requiredAmount) {
        const currentPoolLiquidity = Number(marketData.shared_pool_liquidity || 0);
        if (currentPoolLiquidity < requiredAmount) {
            throw new transaction_1.TransactionError(400, "Insufficient liquidity in the shared pool", {
                available: currentPoolLiquidity,
                required: requiredAmount,
            });
        }
    }
    /**
     * Update wallet balance
     */
    static async updateWalletBalance(client, walletId, newBalance) {
        await client.query(`UPDATE wallets SET balance_usdc = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`, [newBalance, walletId]);
    }
    /**
     * Update option quantities
     */
    static async updateOptionQuantities(client, optionId, newYesQuantity, newNoQuantity) {
        await client.query(`UPDATE market_options SET
        yes_quantity = $1,
        no_quantity = $2,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
       WHERE id = $3`, [newYesQuantity, newNoQuantity, optionId]);
    }
    /**
     * Update market statistics
     */
    static async updateMarketStats(client, marketId, volumeChange, openInterestChange, creatorFee, protocolFee, lpFee, poolLiquidityChange) {
        await client.query(`UPDATE markets SET
        total_volume = total_volume + $1,
        total_open_interest = GREATEST(0, total_open_interest + $2),
        creator_fees_collected = creator_fees_collected + $3,
        lifetime_creator_fees_generated = lifetime_creator_fees_generated + $3,
        protocol_fees_collected = protocol_fees_collected + $4,
        accumulated_lp_fees = accumulated_lp_fees + $5,
        shared_pool_liquidity = GREATEST(0, shared_pool_liquidity + $6),
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
       WHERE id = $7`, [
            volumeChange,
            openInterestChange,
            creatorFee,
            protocolFee,
            lpFee,
            poolLiquidityChange,
            marketId,
        ]);
    }
    /**
     * Update liquidity parameter based on current market state
     * Formula: b = max(base_param * 1000, sqrt(max(liquidity, total_shares)) * 10000)
     * This ensures b scales with both liquidity provision AND trading volume
     * SECURITY FIX: Caps b changes to 10% per trade to prevent manipulation
     */
    static async updateLiquidityParameter(client, marketId, baseLiquidityParam) {
        // Get current liquidity parameter and pool liquidity
        const marketResult = await client.query(`SELECT liquidity_parameter, shared_pool_liquidity FROM markets WHERE id = $1`, [marketId]);
        const currentB = Number(marketResult.rows[0]?.liquidity_parameter || 0);
        const currentLiquidity = Number(marketResult.rows[0]?.shared_pool_liquidity || 0);
        // Get total shares across all options
        const totalSharesResult = await client.query(`SELECT COALESCE(SUM(yes_quantity + no_quantity), 0)::bigint as total_shares
       FROM market_options WHERE market_id = $1`, [marketId]);
        const totalOptionShares = Number(totalSharesResult.rows[0]?.total_shares || 0);
        // Calculate new liquidity parameter
        const marketSize = Math.max(currentLiquidity, totalOptionShares);
        const calculatedB = Math.max(baseLiquidityParam * 1000, Math.floor(Math.sqrt(marketSize) * 10000));
        // SECURITY FIX: Validate and cap liquidity parameter changes
        // Prevents manipulation of b parameter by capping changes to 10% per trade
        const MAX_CHANGE_PERCENT = 0.1; // 10% max change per trade
        const minB = currentB * (1 - MAX_CHANGE_PERCENT);
        const maxB = currentB * (1 + MAX_CHANGE_PERCENT);
        // Cap b within allowed range
        let validatedB = calculatedB;
        if (calculatedB < minB) {
            console.warn(`[TradeService] Liquidity param b change too large (${calculatedB} < ${minB}), capping to ${minB}`);
            validatedB = minB;
        }
        else if (calculatedB > maxB) {
            console.warn(`[TradeService] Liquidity param b change too large (${calculatedB} > ${maxB}), capping to ${maxB}`);
            validatedB = maxB;
        }
        // Ensure validatedB is an integer (bigint doesn't accept decimals)
        validatedB = Math.round(validatedB);
        // Update liquidity parameter
        await client.query(`UPDATE markets SET 
        liquidity_parameter = $1,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
       WHERE id = $2`, [validatedB, marketId]);
    }
    /**
     * Create or update user position
     */
    static async upsertUserPosition(client, userId, marketId, optionId) {
        await client.query(`INSERT INTO user_positions (user_id, market_id, option_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, option_id) DO NOTHING`, [userId, marketId, optionId]);
    }
    /**
     * Update position shares and costs
     */
    static async updatePositionShares(client, userId, optionId, side, quantity, cost) {
        // Get current position for average price calculation
        const positionResult = await client.query(`SELECT * FROM user_positions WHERE user_id = $1 AND option_id = $2`, [userId, optionId]);
        const currentPosition = positionResult.rows[0];
        if (!currentPosition) {
            throw new transaction_1.TransactionError(404, "Position not found");
        }
        if (side === "yes") {
            const newYesShares = Number(currentPosition.yes_shares) + quantity;
            const newTotalYesCost = Number(currentPosition.total_yes_cost) + cost;
            const newAvgYesPrice = newYesShares > 0
                ? Number(BigInt(newTotalYesCost) / BigInt(newYesShares))
                : 0;
            await client.query(`UPDATE user_positions SET
          yes_shares = $1,
          total_yes_cost = $2,
          avg_yes_price = $3,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
         WHERE user_id = $4 AND option_id = $5`, [newYesShares, newTotalYesCost, newAvgYesPrice, userId, optionId]);
        }
        else {
            const newNoShares = Number(currentPosition.no_shares) + quantity;
            const newTotalNoCost = Number(currentPosition.total_no_cost) + cost;
            const newAvgNoPrice = newNoShares > 0
                ? Number(BigInt(newTotalNoCost) / BigInt(newNoShares))
                : 0;
            await client.query(`UPDATE user_positions SET
          no_shares = $1,
          total_no_cost = $2,
          avg_no_price = $3,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
         WHERE user_id = $4 AND option_id = $5`, [newNoShares, newTotalNoCost, newAvgNoPrice, userId, optionId]);
        }
    }
    /**
     * Perform pre-trade checks
     */
    static async performPreTradeChecks(client) {
        await (0, tradeUtils_1.checkAdminControls)(client);
    }
}
exports.CommonTradeOperations = CommonTradeOperations;
//# sourceMappingURL=commonTradeOperations.js.map