"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskControlService = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const SuspiciousTrade_1 = require("../models/SuspiciousTrade");
const lmsr_1 = require("../utils/lmsr");
const tradeUtils_1 = require("../utils/tradeUtils");
class RiskControlService {
    /**
     * Check for suspicious trades based on threshold
     */
    static async checkSuspiciousTrade(client, userId, marketId, optionId, tradeType, side, quantity, totalAmount, pricePerShare) {
        const moodring = await (0, tradeUtils_1.getMoodringData)(client);
        if (totalAmount >= moodring.suspicious_trade_threshold) {
            console.warn(`SUSPICIOUS TRADE DETECTED: User ${userId} placed ${tradeType} trade of ${totalAmount} USDC (threshold: ${moodring.suspicious_trade_threshold})`);
            // Log to suspicious_trades table
            await SuspiciousTrade_1.SuspiciousTradeModel.create({
                user_id: userId,
                market_id: marketId,
                option_id: optionId,
                trade_type: tradeType,
                side: side,
                quantity,
                price_per_share: pricePerShare,
                total_amount: totalAmount,
                detection_reason: "suspicious_trade_threshold",
                detection_metadata: {
                    threshold: moodring.suspicious_trade_threshold,
                    total_amount: totalAmount,
                    market_id: marketId,
                    option_id: optionId,
                },
                risk_score: Math.min(100, Math.floor((totalAmount / moodring.suspicious_trade_threshold) * 50)), // Scale risk score
            }, client);
            // For now, we allow suspicious trades but log them
            // In production, you might want to block them
            return { passed: true };
        }
        return { passed: true };
    }
    /**
     * Check circuit breaker for recent market volume
     * DISABLED: No longer blocks trades, only logs for monitoring
     */
    static async checkCircuitBreaker(client, userId, marketId, optionId, tradeType, side, quantity, totalAmount, pricePerShare) {
        const moodring = await (0, tradeUtils_1.getMoodringData)(client);
        const oneHourAgo = Math.floor((Date.now() - 60 * 60 * 1000) / 1000); // Unix timestamp in seconds
        const recentVolumeResult = await client.query(`SELECT COALESCE(SUM(total_cost), 0)::bigint as recent_volume
       FROM trades
       WHERE market_id = $1 AND created_at >= $2`, [marketId, oneHourAgo]);
        const recentVolume = Number(recentVolumeResult.rows[0]?.recent_volume || 0);
        if (recentVolume >= moodring.circuit_breaker_threshold) {
            // Log the circuit breaker trigger as a suspicious activity (for monitoring only)
            await SuspiciousTrade_1.SuspiciousTradeModel.create({
                user_id: userId,
                market_id: marketId,
                option_id: optionId,
                trade_type: tradeType,
                side: side,
                quantity,
                price_per_share: pricePerShare,
                total_amount: totalAmount,
                detection_reason: "circuit_breaker",
                detection_metadata: {
                    threshold: moodring.circuit_breaker_threshold,
                    recent_volume: recentVolume,
                    trade_amount: totalAmount,
                    market_id: marketId,
                    option_id: optionId,
                },
                risk_score: 100, // Circuit breaker triggers are high risk
                automated_action_taken: false, // No longer halting trading
            }, client);
            // Circuit breaker check disabled - always pass
            return { passed: true };
        }
        return { passed: true };
    }
    /**
     * Check price volatility to prevent manipulation
     */
    static async checkVolatility(client, currentYes, currentNo, buyYes, buyNo, liquidityParam, marketId, optionId) {
        const moodring = await (0, tradeUtils_1.getMoodringData)(client);
        // Calculate current price before trade
        const currentYesPrice = (0, lmsr_1.calculate_yes_price)(currentYes, currentNo, liquidityParam);
        const currentPrice = Number(currentYesPrice) / Number(lmsr_1.PRECISION);
        // Calculate price after trade
        const newYesPrice = (0, lmsr_1.calculate_yes_price)(currentYes.add(new anchor_1.BN(buyYes)), currentNo.add(new anchor_1.BN(buyNo)), liquidityParam);
        const newPrice = Number(newYesPrice) / Number(lmsr_1.PRECISION);
        // Calculate volatility (price change in basis points)
        const priceChange = Math.abs(newPrice - currentPrice);
        const volatilityBps = Math.floor((priceChange / currentPrice) * 10000);
        // Dynamic threshold based on market maturity
        // Early markets naturally have higher volatility due to LMSR mechanics
        const totalSharesBefore = Number(currentYes) + Number(currentNo);
        const tradeSize = buyYes + buyNo;
        // Scale threshold based on market liquidity relative to trade size
        // More liquid markets = lower threshold, less liquid = higher threshold
        let adjustedThreshold = moodring.max_market_volatility_threshold;
        if (totalSharesBefore < tradeSize * 10) {
            // Very new market - allow up to 5x normal volatility
            adjustedThreshold *= 5;
        }
        else if (totalSharesBefore < tradeSize * 50) {
            // Moderately new market - allow up to 3x normal volatility
            adjustedThreshold *= 3;
        }
        else if (totalSharesBefore < tradeSize * 100) {
            // Established market - allow up to 2x normal volatility
            adjustedThreshold *= 2;
        }
        // Well-established markets use the base threshold
        // Volatility check disabled - always pass
        return {
            passed: true,
            currentPrice,
            newPrice,
            volatilityBps,
            adjustedThreshold,
        };
    }
    /**
     * Check volatility for sell trades
     */
    static async checkSellVolatility(client, currentYes, currentNo, sellYes, sellNo, liquidityParam, marketId, optionId) {
        const moodring = await (0, tradeUtils_1.getMoodringData)(client);
        // Calculate current price before trade
        const currentYesPrice = (0, lmsr_1.calculate_yes_price)(currentYes, currentNo, liquidityParam);
        const currentPrice = Number(currentYesPrice) / Number(lmsr_1.PRECISION);
        // Calculate price after trade
        const newYesPrice = (0, lmsr_1.calculate_yes_price)(currentYes.sub(new anchor_1.BN(sellYes)), currentNo.sub(new anchor_1.BN(sellNo)), liquidityParam);
        const newPrice = Number(newYesPrice) / Number(lmsr_1.PRECISION);
        // Calculate volatility (price change in basis points)
        const priceChange = Math.abs(newPrice - currentPrice);
        const volatilityBps = Math.floor((priceChange / currentPrice) * 10000);
        // Dynamic threshold based on market maturity
        const totalSharesBefore = Number(currentYes) + Number(currentNo);
        const tradeSize = sellYes + sellNo;
        // Scale threshold based on market liquidity relative to trade size
        let adjustedThreshold = moodring.max_market_volatility_threshold;
        if (totalSharesBefore < tradeSize * 10) {
            // Very new market - allow up to 5x normal volatility
            adjustedThreshold *= 5;
        }
        else if (totalSharesBefore < tradeSize * 50) {
            // Moderately new market - allow up to 3x normal volatility
            adjustedThreshold *= 3;
        }
        else if (totalSharesBefore < tradeSize * 100) {
            // Established market - allow up to 2x normal volatility
            adjustedThreshold *= 2;
        }
        // Volatility check disabled - always pass
        return {
            passed: true,
            currentPrice,
            newPrice,
            volatilityBps,
            adjustedThreshold,
        };
    }
    /**
     * Run all risk checks for a trade
     */
    static async performRiskChecks(client, params) {
        const { userId, marketId, optionId, tradeType, side, quantity, totalAmount, pricePerShare, currentYes, currentNo, buyYes = 0, buyNo = 0, sellYes = 0, sellNo = 0, liquidityParam, } = params;
        // 1. Suspicious Trade Threshold Check
        const suspiciousCheck = await this.checkSuspiciousTrade(client, userId, marketId, optionId, tradeType, side, quantity, totalAmount, pricePerShare);
        if (!suspiciousCheck.passed) {
            return suspiciousCheck;
        }
        // 2. Circuit Breaker Check
        const circuitCheck = await this.checkCircuitBreaker(client, userId, marketId, optionId, tradeType, side, quantity, totalAmount, pricePerShare);
        if (!circuitCheck.passed) {
            return circuitCheck;
        }
        // 3. Volatility Check
        if (currentYes && currentNo && liquidityParam) {
            const volatilityCheck = tradeType === "buy"
                ? await this.checkVolatility(client, currentYes, currentNo, buyYes, buyNo, liquidityParam, marketId, optionId)
                : await this.checkSellVolatility(client, currentYes, currentNo, sellYes, sellNo, liquidityParam, marketId, optionId);
            if (!volatilityCheck.passed) {
                return volatilityCheck;
            }
        }
        return { passed: true };
    }
}
exports.RiskControlService = RiskControlService;
//# sourceMappingURL=riskControl.js.map