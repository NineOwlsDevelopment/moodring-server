"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateFees = calculateFees;
exports.getMoodringData = getMoodringData;
exports.checkAdminControls = checkAdminControls;
/**
 * Calculate fees for a trade
 */
function calculateFees(amount, protocolFeeBps, creatorFeeBps, lpFeeBps) {
    const totalFee = Math.floor((amount * (protocolFeeBps + creatorFeeBps + lpFeeBps)) / 10000);
    const protocolFee = Math.floor((amount * protocolFeeBps) / 10000);
    const creatorFee = Math.floor((amount * creatorFeeBps) / 10000);
    const lpFee = Math.floor((amount * lpFeeBps) / 10000);
    console.log("totalFee", totalFee);
    console.log("protocolFee", protocolFee);
    console.log("creatorFee", creatorFee);
    console.log("lpFee", lpFee);
    console.log("amount", amount);
    return {
        protocolFee,
        creatorFee,
        lpFee,
        totalFee,
        netAmount: amount - totalFee,
    };
}
/**
 * Get moodring configuration data
 */
async function getMoodringData(client) {
    const moodringResult = await client.query(`SELECT * FROM moodring`);
    const moodring = moodringResult.rows[0];
    if (!moodring) {
        console.log("Moodring data not set");
        throw new Error("Moodring not found");
    }
    return moodring;
}
/**
 * Check admin controls for trading operations
 */
async function checkAdminControls(client) {
    const moodring = await getMoodringData(client);
    if (moodring.maintenance_mode) {
        throw new Error("Platform is currently under maintenance. Trading is temporarily disabled.");
    }
    if (!moodring.allow_trading) {
        throw new Error("Trading is currently disabled by administrators.");
    }
    if (moodring.pause_trading) {
        throw new Error("Trading is temporarily paused");
    }
    return moodring;
}
//# sourceMappingURL=tradeUtils.js.map