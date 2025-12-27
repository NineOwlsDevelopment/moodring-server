"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeService = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const transaction_1 = require("../utils/transaction");
const lmsr_1 = require("../utils/lmsr");
const tradeUtils_1 = require("../utils/tradeUtils");
const tradeValidation_1 = require("./tradeValidation");
const commonTradeOperations_1 = require("./commonTradeOperations");
const Moodring_1 = require("../models/Moodring");
class TradeService {
    /**
     * Execute a buy trade
     */
    static async executeBuy(client, userId, marketId, optionId, buyYes, buyNo, maxCost, slippageBps) {
        // Pre-trade checks
        await commonTradeOperations_1.CommonTradeOperations.performPreTradeChecks(client);
        // Get and lock resources in consistent order
        const marketData = await commonTradeOperations_1.CommonTradeOperations.getMarketWithLock(client, marketId);
        const optionData = await commonTradeOperations_1.CommonTradeOperations.getOptionWithLock(client, optionId);
        const wallet = await commonTradeOperations_1.CommonTradeOperations.getWalletWithLock(client, userId);
        // Calculate cost using LMSR
        const liquidityParam = new anchor_1.BN(marketData.liquidity_parameter);
        const currentYes = new anchor_1.BN(Math.floor(Number(optionData.yes_quantity)));
        const currentNo = new anchor_1.BN(Math.floor(Number(optionData.no_quantity)));
        let cost;
        try {
            cost = (0, lmsr_1.calculate_buy_cost)(currentYes, currentNo, new anchor_1.BN(buyYes), new anchor_1.BN(buyNo), liquidityParam);
        }
        catch (error) {
            throw new transaction_1.TransactionError(400, "Failed to calculate cost");
        }
        // Minimum cost check
        if (cost < 0.01) {
            cost = 0.01 * 1000000;
        }
        const rawCost = cost;
        const moodring = await (0, tradeUtils_1.getMoodringData)(client);
        // Calculate fees
        const { protocolFee, creatorFee, lpFee, totalFee, netAmount } = (0, tradeUtils_1.calculateFees)(rawCost, Number(moodring.protocol_fee_rate), Number(moodring.creator_fee_rate), Number(moodring.lp_fee_rate));
        const totalCost = rawCost + totalFee;
        // Validate trade limits (after cost calculation, using total cost in micro-USDC)
        const limitsCheck = await tradeValidation_1.TradeValidationService.validateTradeLimits(client, totalCost, userId, marketId, optionId, true);
        if (!limitsCheck.isValid) {
            throw new transaction_1.TransactionError(400, limitsCheck.error);
        }
        // Calculate trade details for risk checks
        const side = buyYes > 0 ? "yes" : "no";
        const quantity = buyYes > 0 ? buyYes : buyNo;
        const pricePerShare = quantity > 0 ? Math.floor((rawCost * 1000000) / quantity) : 0;
        // Check slippage
        // maxCost should be the expected total cost (including fees) that the user is willing to pay
        // slippageBps is the slippage tolerance in basis points
        // If both are provided, maxCost is the maximum allowed cost with slippage already applied
        // If only maxCost is provided, use it directly
        // If only slippageBps is provided, we can't validate without expected cost (skip validation)
        let expectedTotalCost;
        if (maxCost !== undefined) {
            // maxCost is the expected total cost (including fees) that user is willing to pay
            expectedTotalCost = Number(maxCost);
        }
        const slippageCheck = tradeValidation_1.TradeValidationService.validateSlippage(slippageBps, maxCost, expectedTotalCost, totalCost);
        if (!slippageCheck.isValid) {
            throw new transaction_1.TransactionError(400, slippageCheck.error);
        }
        // Check balance
        commonTradeOperations_1.CommonTradeOperations.checkWalletBalance(wallet, totalCost);
        // Execute trade
        // Deduct from wallet
        const newBalance = wallet.balance_usdc - totalCost;
        await commonTradeOperations_1.CommonTradeOperations.updateWalletBalance(client, wallet.id, newBalance);
        // Update option quantities
        const newYesQuantity = Number(optionData.yes_quantity) + buyYes;
        const newNoQuantity = Number(optionData.no_quantity) + buyNo;
        await commonTradeOperations_1.CommonTradeOperations.updateOptionQuantities(client, optionId, newYesQuantity, newNoQuantity);
        // Update market stats and shared pool liquidity
        const newPoolLiquidity = Number(marketData.shared_pool_liquidity || 0) + rawCost;
        await commonTradeOperations_1.CommonTradeOperations.updateMarketStats(client, marketId, totalCost, buyYes + buyNo, creatorFee, protocolFee, lpFee, rawCost);
        // Update liquidity parameter to scale with new share quantities
        // This ensures prices remain stable as markets grow through trading
        const baseLiquidityParam = Number(marketData.base_liquidity_parameter) || 100000;
        await commonTradeOperations_1.CommonTradeOperations.updateLiquidityParameter(client, marketId, baseLiquidityParam);
        // Track protocol fees
        if (protocolFee > 0) {
            await Moodring_1.MoodringModel.recordFees(creatorFee, protocolFee, client);
        }
        // Create/update user position
        await commonTradeOperations_1.CommonTradeOperations.upsertUserPosition(client, userId, marketId, optionId);
        await commonTradeOperations_1.CommonTradeOperations.updatePositionShares(client, userId, optionId, side, quantity, rawCost);
        return {
            wallet,
            newYesQuantity,
            newNoQuantity,
            liquidityParam,
            side: side,
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
    static async executeSell(client, userId, marketId, optionId, sellYes, sellNo, minPayout, slippageBps) {
        // Pre-trade checks
        await commonTradeOperations_1.CommonTradeOperations.performPreTradeChecks(client);
        // Get and lock resources in consistent order
        const marketData = await commonTradeOperations_1.CommonTradeOperations.getMarketWithLock(client, marketId);
        const optionData = await commonTradeOperations_1.CommonTradeOperations.getOptionWithLock(client, optionId);
        const position = await commonTradeOperations_1.CommonTradeOperations.getUserPositionWithLock(client, userId, optionId);
        // Check sufficient shares
        commonTradeOperations_1.CommonTradeOperations.checkSufficientShares(position, sellYes, sellNo);
        // Calculate payout using LMSR
        const liquidityParam = new anchor_1.BN(marketData.liquidity_parameter);
        const currentYes = new anchor_1.BN(Math.floor(Number(optionData.yes_quantity)));
        const currentNo = new anchor_1.BN(Math.floor(Number(optionData.no_quantity)));
        let payout;
        try {
            payout = (0, lmsr_1.calculate_sell_payout)(currentYes, currentNo, new anchor_1.BN(sellYes), new anchor_1.BN(sellNo), liquidityParam);
        }
        catch (error) {
            throw new transaction_1.TransactionError(400, "Failed to calculate payout");
        }
        const rawPayout = payout;
        const moodring = await (0, tradeUtils_1.getMoodringData)(client);
        // Calculate fees (fees are deducted from payout)
        const { protocolFee, creatorFee, lpFee, totalFee } = (0, tradeUtils_1.calculateFees)(rawPayout, Number(moodring.protocol_fee_rate), Number(moodring.creator_fee_rate), Number(moodring.lp_fee_rate));
        const netPayout = rawPayout - totalFee;
        // Validate trade limits (after payout calculation, using raw payout value in micro-USDC)
        // For sells, we validate based on the payout amount (trade size)
        const limitsCheck = await tradeValidation_1.TradeValidationService.validateTradeLimits(client, rawPayout, userId, marketId, optionId, false);
        if (!limitsCheck.isValid) {
            throw new transaction_1.TransactionError(400, limitsCheck.error);
        }
        // Calculate trade details for risk checks
        const side = sellYes > 0 ? "yes" : "no";
        const quantity = sellYes > 0 ? sellYes : sellNo;
        const pricePerShare = quantity > 0 ? Math.floor((netPayout * 1000000) / quantity) : 0;
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
                const minAllowedNetPayout = Math.floor(expectedNetPayout * (1 - Number(slippageBps) / 10000));
                if (netPayout < minAllowedNetPayout) {
                    throw new transaction_1.TransactionError(400, `Slippage tolerance exceeded. Expected min: ${minAllowedNetPayout / 10 ** 6} USDC, Actual: ${netPayout / 10 ** 6} USDC`);
                }
            }
            else {
                // No slippage tolerance, just check minimum
                if (netPayout < expectedNetPayout) {
                    throw new transaction_1.TransactionError(400, "Payout below minimum");
                }
            }
        }
        // Check pool liquidity
        commonTradeOperations_1.CommonTradeOperations.checkPoolLiquidity(marketData, rawPayout);
        // Get wallet with lock
        const wallet = await commonTradeOperations_1.CommonTradeOperations.getWalletWithLock(client, userId);
        // Calculate realized PnL
        const avgPrice = side === "yes"
            ? BigInt(Math.round(Number(position?.avg_yes_price || 0)))
            : BigInt(Math.round(Number(position?.avg_no_price || 0)));
        const costBasis = Number(BigInt(quantity) * avgPrice);
        const realizedPnl = netPayout - costBasis;
        // Execute trade
        // Deduct raw payout from shared pool
        const newPoolLiquidity = Math.max(0, Number(marketData.shared_pool_liquidity || 0) - rawPayout);
        // Credit wallet
        const newBalance = Number(wallet.balance_usdc) + netPayout;
        await commonTradeOperations_1.CommonTradeOperations.updateWalletBalance(client, wallet.id, newBalance);
        // Update option quantities
        const newYesQuantity = Number(optionData.yes_quantity) - sellYes;
        const newNoQuantity = Number(optionData.no_quantity) - sellNo;
        await commonTradeOperations_1.CommonTradeOperations.updateOptionQuantities(client, optionId, newYesQuantity, newNoQuantity);
        // Update market stats
        await commonTradeOperations_1.CommonTradeOperations.updateMarketStats(client, marketId, rawPayout, -(sellYes + sellNo), // Decrease open interest
        creatorFee, protocolFee, lpFee, -rawPayout);
        // Update liquidity parameter to scale with new share quantities
        // This ensures prices remain stable as markets grow through trading
        const baseLiquidityParam = Number(marketData.base_liquidity_parameter) || 100000;
        await commonTradeOperations_1.CommonTradeOperations.updateLiquidityParameter(client, marketId, baseLiquidityParam);
        // Track protocol fees
        if (protocolFee > 0) {
            await Moodring_1.MoodringModel.recordFees(creatorFee, protocolFee, client);
        }
        // Update user position
        await this.updatePositionForSell(client, userId, optionId, side, quantity, realizedPnl);
        return {
            wallet,
            newYesQuantity,
            newNoQuantity,
            liquidityParam,
            side: side,
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
    static async executeClaim(client, userId, marketId, optionId) {
        // Get option (must be resolved)
        const optionData = await commonTradeOperations_1.CommonTradeOperations.getOption(client, optionId);
        if (!optionData.is_resolved) {
            throw new transaction_1.TransactionError(400, "Option is not resolved yet");
        }
        // Check if dispute deadline has passed (if one exists)
        // OPINION mode options don't have dispute deadlines and can be claimed immediately
        if (optionData.dispute_deadline && optionData.dispute_deadline > 0) {
            const currentTime = Math.floor(Date.now() / 1000);
            if (currentTime < optionData.dispute_deadline) {
                const timeRemaining = optionData.dispute_deadline - currentTime;
                const hoursRemaining = Math.ceil(timeRemaining / 3600);
                throw new transaction_1.TransactionError(400, `Resolution period has not ended yet. Please wait ${hoursRemaining} hour${hoursRemaining !== 1 ? "s" : ""} before claiming winnings.`);
            }
        }
        // Get user position with lock
        const position = await commonTradeOperations_1.CommonTradeOperations.getUserPositionWithLock(client, userId, optionId);
        if (!position) {
            throw new transaction_1.TransactionError(404, "No position found");
        }
        if (position.is_claimed) {
            throw new transaction_1.TransactionError(400, "Winnings have already been claimed for this position");
        }
        const yesShares = Number(position.yes_shares);
        const noShares = Number(position.no_shares);
        if (yesShares <= 0 && noShares <= 0) {
            throw new transaction_1.TransactionError(400, "No shares to claim");
        }
        // winning_side: 1 = YES, 2 = NO
        const winningSide = optionData.winning_side;
        const winningShares = winningSide === 1 ? yesShares : noShares;
        // Payout is 1 micro-USDC per micro-share (shares are now stored in 6 decimal format)
        const payout = winningShares;
        // Calculate PnL
        const totalCostBasis = Number(position.total_yes_cost) + Number(position.total_no_cost);
        const realizedPnl = payout - totalCostBasis;
        // Get market with lock
        const marketData = await commonTradeOperations_1.CommonTradeOperations.getMarketWithLock(client, marketId);
        // Check pool liquidity
        commonTradeOperations_1.CommonTradeOperations.checkPoolLiquidity(marketData, payout);
        // Get wallet with lock
        const wallet = await commonTradeOperations_1.CommonTradeOperations.getWalletWithLock(client, userId);
        // Deduct payout from shared pool
        const newPoolLiquidity = Math.max(0, Number(marketData.shared_pool_liquidity || 0) - payout);
        // Update market shared pool liquidity
        await client.query(`UPDATE markets SET
        shared_pool_liquidity = $1,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
       WHERE id = $2`, [newPoolLiquidity, marketId]);
        // Credit wallet
        const newBalance = Number(wallet.balance_usdc) + payout;
        await commonTradeOperations_1.CommonTradeOperations.updateWalletBalance(client, wallet.id, newBalance);
        // Zero out position and mark as claimed
        await client.query(`UPDATE user_positions SET
        yes_shares = 0,
        no_shares = 0,
        total_yes_cost = 0,
        total_no_cost = 0,
        realized_pnl = realized_pnl + $1,
        is_claimed = TRUE,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
       WHERE user_id = $2 AND option_id = $3`, [realizedPnl, userId, optionId]);
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
    static async updatePositionForSell(client, userId, optionId, side, quantity, realizedPnl) {
        // Get current position
        const positionResult = await client.query(`SELECT * FROM user_positions WHERE user_id = $1 AND option_id = $2`, [userId, optionId]);
        const currentPosition = positionResult.rows[0];
        if (!currentPosition) {
            throw new transaction_1.TransactionError(404, "Position not found");
        }
        if (side === "yes") {
            const newYesShares = Number(currentPosition.yes_shares) - quantity;
            const newTotalYesCost = Number(BigInt(newYesShares) *
                BigInt(Math.round(Number(currentPosition.avg_yes_price))));
            await client.query(`UPDATE user_positions SET
          yes_shares = $1,
          total_yes_cost = $2,
          realized_pnl = realized_pnl + $3,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
         WHERE user_id = $4 AND option_id = $5`, [
                newYesShares,
                newTotalYesCost,
                Math.round(realizedPnl),
                userId,
                optionId,
            ]);
        }
        else {
            const newNoShares = Number(currentPosition.no_shares) - quantity;
            const newTotalNoCost = Number(BigInt(newNoShares) *
                BigInt(Math.round(Number(currentPosition.avg_no_price))));
            await client.query(`UPDATE user_positions SET
          no_shares = $1,
          total_no_cost = $2,
          realized_pnl = realized_pnl + $3,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
         WHERE user_id = $4 AND option_id = $5`, [newNoShares, newTotalNoCost, Math.round(realizedPnl), userId, optionId]);
        }
    }
}
exports.TradeService = TradeService;
//# sourceMappingURL=tradeService.js.map