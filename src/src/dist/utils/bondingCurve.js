"use strict";
/**
 * Bonding curve pricing utility (friend.tech style)
 *
 * Formula: price = (supply^2) / 16000
 *
 * This creates a quadratic bonding curve where:
 * - Price increases quadratically with supply
 * - Each key purchase increases the price for the next purchase
 * - Selling keys decreases the supply and price
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKeyPrice = getKeyPrice;
exports.getKeyPriceMicroUsdc = getKeyPriceMicroUsdc;
exports.getBuyCost = getBuyCost;
exports.getBuyCostMicroUsdc = getBuyCostMicroUsdc;
exports.getSellPayout = getSellPayout;
exports.getSellPayoutMicroUsdc = getSellPayoutMicroUsdc;
exports.getAverageBuyPrice = getAverageBuyPrice;
exports.getAverageSellPrice = getAverageSellPrice;
/**
 * Calculate the price for a key at a given supply
 * @param supply - Current supply of keys
 * @returns Price in USDC (not micro-USDC)
 */
function getKeyPrice(supply) {
    if (supply < 0) {
        return 0;
    }
    return (supply * supply) / 16000;
}
/**
 * Calculate the price in micro-USDC (6 decimals)
 * @param supply - Current supply of keys
 * @returns Price in micro-USDC
 */
function getKeyPriceMicroUsdc(supply) {
    return Math.floor(getKeyPrice(supply) * 1000000);
}
/**
 * Calculate the cost to buy N keys starting from a given supply
 * This integrates the bonding curve from supply to supply + quantity
 *
 * Cost = integral from supply to supply+quantity of (x^2 / 16000) dx
 *      = (1/16000) * integral from supply to supply+quantity of x^2 dx
 *      = (1/16000) * [(supply+quantity)^3 - supply^3] / 3
 *      = [(supply+quantity)^3 - supply^3] / 48000
 *
 * @param supply - Current supply before purchase
 * @param quantity - Number of keys to buy
 * @returns Total cost in USDC
 */
function getBuyCost(supply, quantity) {
    if (quantity <= 0) {
        return 0;
    }
    if (supply < 0) {
        supply = 0;
    }
    const supplyAfter = supply + quantity;
    const cost = (Math.pow(supplyAfter, 3) - Math.pow(supply, 3)) / 48000;
    return Math.max(0, cost);
}
/**
 * Calculate the cost to buy N keys in micro-USDC
 * @param supply - Current supply before purchase
 * @param quantity - Number of keys to buy
 * @returns Total cost in micro-USDC
 */
function getBuyCostMicroUsdc(supply, quantity) {
    return Math.floor(getBuyCost(supply, quantity) * 1000000);
}
/**
 * Calculate the payout for selling N keys starting from a given supply
 * This is the integral from supply-quantity to supply
 *
 * Payout = integral from supply-quantity to supply of (x^2 / 16000) dx
 *        = [(supply)^3 - (supply-quantity)^3] / 48000
 *
 * @param supply - Current supply before sale
 * @param quantity - Number of keys to sell
 * @returns Total payout in USDC
 */
function getSellPayout(supply, quantity) {
    if (quantity <= 0) {
        return 0;
    }
    if (supply <= 0) {
        return 0;
    }
    if (supply < quantity) {
        quantity = supply; // Can't sell more than exists
    }
    const supplyBefore = supply;
    const supplyAfter = supply - quantity;
    const payout = (Math.pow(supplyBefore, 3) - Math.pow(supplyAfter, 3)) / 48000;
    return Math.max(0, payout);
}
/**
 * Calculate the payout for selling N keys in micro-USDC
 * @param supply - Current supply before sale
 * @param quantity - Number of keys to sell
 * @returns Total payout in micro-USDC
 */
function getSellPayoutMicroUsdc(supply, quantity) {
    return Math.floor(getSellPayout(supply, quantity) * 1000000);
}
/**
 * Calculate the price per key for buying N keys (average price)
 * @param supply - Current supply before purchase
 * @param quantity - Number of keys to buy
 * @returns Average price per key in USDC
 */
function getAverageBuyPrice(supply, quantity) {
    if (quantity <= 0) {
        return 0;
    }
    const totalCost = getBuyCost(supply, quantity);
    return totalCost / quantity;
}
/**
 * Calculate the price per key for selling N keys (average price)
 * @param supply - Current supply before sale
 * @param quantity - Number of keys to sell
 * @returns Average price per key in USDC
 */
function getAverageSellPrice(supply, quantity) {
    if (quantity <= 0) {
        return 0;
    }
    const totalPayout = getSellPayout(supply, quantity);
    return totalPayout / quantity;
}
//# sourceMappingURL=bondingCurve.js.map