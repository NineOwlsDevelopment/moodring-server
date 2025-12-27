"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startResolutionProcessor = void 0;
const db_1 = require("../db");
const Resolution_1 = require("../models/Resolution");
const Activity_1 = require("../models/Activity");
const Notification_1 = require("../models/Notification");
const DEFAULT_POLL_INTERVAL_MS = 60000; // Check every minute
/**
 * Service that automatically processes resolution payouts and resolves markets
 * - Processes payouts for options whose dispute deadline has passed
 * - Auto-resolves markets when all options are resolved
 */
class ResolutionProcessor {
    constructor(pollIntervalMs) {
        this.pollIntervalMs = pollIntervalMs;
        this.timer = null;
        this.isRunning = false;
        this.started = false;
    }
    start() {
        if (this.started) {
            return;
        }
        this.started = true;
        console.log(`[ResolutionProcessor] Started (interval=${this.pollIntervalMs}ms)`);
        this.pollLoop();
    }
    stop() {
        this.started = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    scheduleNext() {
        if (!this.started) {
            return;
        }
        this.timer = setTimeout(() => this.pollLoop(), this.pollIntervalMs);
    }
    async pollLoop() {
        if (!this.started) {
            return;
        }
        if (this.isRunning) {
            this.scheduleNext();
            return;
        }
        this.isRunning = true;
        try {
            await this.processResolutions();
        }
        catch (error) {
            console.error("[ResolutionProcessor] Poll loop error:", error);
        }
        finally {
            this.isRunning = false;
            this.scheduleNext();
        }
    }
    async processResolutions() {
        // Process payouts for options whose dispute deadline has passed
        await this.processOptionPayouts();
        // Auto-resolve markets where all options are resolved
        await this.autoResolveMarkets();
    }
    /**
     * Process payouts for options whose dispute deadline has passed
     */
    async processOptionPayouts() {
        const client = await db_1.pool.connect();
        try {
            await client.query("BEGIN");
            // Find options that are resolved, have passed dispute deadline, and have unclaimed positions
            // We check for options where dispute_deadline < NOW() and is_resolved = TRUE
            const optionsResult = await client.query(`SELECT o.*, m.id as market_id
         FROM market_options o
         JOIN markets m ON m.id = o.market_id
         WHERE o.is_resolved = TRUE
           AND o.dispute_deadline IS NOT NULL
           AND o.dispute_deadline > 0
           AND o.dispute_deadline < EXTRACT(EPOCH FROM NOW())::BIGINT
           AND EXISTS (
             SELECT 1 FROM user_positions up
             WHERE up.option_id = o.id
               AND up.is_claimed = FALSE
               AND (up.yes_shares > 0 OR up.no_shares > 0)
           )
         FOR UPDATE SKIP LOCKED
         LIMIT 10`);
            const options = optionsResult.rows;
            if (options.length === 0) {
                await client.query("COMMIT");
                return;
            }
            console.log(`[ResolutionProcessor] Processing payouts for ${options.length} options`);
            for (const option of options) {
                try {
                    await this.processOptionPayout(option, client);
                }
                catch (error) {
                    console.error(`[ResolutionProcessor] Error processing payout for option ${option.id}:`, error.message);
                    // Continue with other options
                }
            }
            await client.query("COMMIT");
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Process payout for a single option (similar to autoCreditWinnings)
     */
    async processOptionPayout(option, client) {
        const optionId = option.id;
        const marketId = option.market_id;
        const winningSide = option.winning_side;
        if (!winningSide) {
            console.warn(`[ResolutionProcessor] Option ${optionId} has no winning_side, skipping`);
            return;
        }
        // Get ALL positions for this option that haven't been claimed
        const positionsResult = await client.query(`SELECT up.*, w.id as wallet_id
       FROM user_positions up
       JOIN wallets w ON w.user_id = up.user_id
       WHERE up.option_id = $1 
         AND up.is_claimed = FALSE
         AND (up.yes_shares > 0 OR up.no_shares > 0)
       FOR UPDATE`, [optionId]);
        const positions = positionsResult.rows;
        if (positions.length === 0) {
            return; // No positions to process
        }
        // Get market data to check pool liquidity
        const marketResult = await client.query(`SELECT shared_pool_liquidity, base_liquidity_parameter FROM markets WHERE id = $1 FOR UPDATE`, [marketId]);
        const marketData = marketResult.rows[0];
        if (!marketData) {
            return;
        }
        let currentPoolLiquidity = Number(marketData.shared_pool_liquidity || 0);
        let totalPayout = 0;
        const winnerUpdates = [];
        const loserUpdates = [];
        // Process all positions - separate winners and losers
        for (const position of positions) {
            const yesShares = Number(position.yes_shares);
            const noShares = Number(position.no_shares);
            const winningShares = winningSide === 1 ? yesShares : noShares;
            const totalCostBasis = Number(position.total_yes_cost) + Number(position.total_no_cost);
            if (winningShares > 0) {
                // Winner: gets payout
                const payout = winningShares;
                const realizedPnl = payout - totalCostBasis;
                // Check if pool has enough liquidity
                if (currentPoolLiquidity < payout) {
                    console.warn(`[ResolutionProcessor] Insufficient pool liquidity for option ${optionId}. User ${position.user_id} will need to claim manually.`);
                    continue; // Skip this user, they can claim manually
                }
                currentPoolLiquidity -= payout;
                totalPayout += payout;
                winnerUpdates.push({
                    userId: position.user_id,
                    walletId: position.wallet_id,
                    payout,
                    realizedPnl,
                });
            }
            else {
                // Loser: gets $0 payout, loses their cost basis
                const realizedPnl = -totalCostBasis; // Negative PnL = loss
                loserUpdates.push({
                    userId: position.user_id,
                    realizedPnl,
                });
            }
        }
        // Update wallets for winners
        for (const update of winnerUpdates) {
            await client.query(`UPDATE wallets SET balance_usdc = balance_usdc + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`, [update.payout, update.walletId]);
        }
        // Update positions for winners - zero out shares and mark as claimed
        for (const update of winnerUpdates) {
            await client.query(`UPDATE user_positions SET 
          yes_shares = 0, 
          no_shares = 0,
          total_yes_cost = 0,
          total_no_cost = 0,
          realized_pnl = realized_pnl + $1,
          is_claimed = TRUE,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
         WHERE user_id = $2 AND option_id = $3`, [update.realizedPnl, update.userId, optionId]);
        }
        // Update positions for losers - zero out shares and record loss
        for (const update of loserUpdates) {
            await client.query(`UPDATE user_positions SET 
          yes_shares = 0, 
          no_shares = 0,
          total_yes_cost = 0,
          total_no_cost = 0,
          realized_pnl = realized_pnl + $1,
          is_claimed = TRUE,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
         WHERE user_id = $2 AND option_id = $3`, [update.realizedPnl, update.userId, optionId]);
        }
        // Update market pool liquidity
        await client.query(`UPDATE markets SET 
        shared_pool_liquidity = $1,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
       WHERE id = $2`, [currentPoolLiquidity, marketId]);
        // Create notifications and activities for each winner (non-blocking)
        for (const update of winnerUpdates) {
            try {
                await Notification_1.NotificationModel.create({
                    user_id: update.userId,
                    notification_type: "trade_executed",
                    title: "Winnings Credited",
                    message: `Your winnings of ${update.payout / 1000000} USDC have been automatically added to your wallet.`,
                    entity_type: "option",
                    entity_id: optionId,
                    metadata: {
                        market_id: marketId,
                        payout: update.payout,
                        winning_side: winningSide === 1 ? "yes" : "no",
                        realized_pnl: update.realizedPnl,
                        auto_credited: true,
                    },
                });
                await Activity_1.ActivityModel.create({
                    user_id: update.userId,
                    activity_type: "claim",
                    entity_type: "option",
                    entity_id: optionId,
                    metadata: {
                        payout: update.payout,
                        winning_side: winningSide === 1 ? "yes" : "no",
                        realized_pnl: update.realizedPnl,
                        market_id: marketId,
                        auto_credited: true,
                    },
                });
            }
            catch (notifError) {
                console.error(`[ResolutionProcessor] Error creating notification for user ${update.userId}:`, notifError);
            }
        }
        // Create notifications and activities for each loser (non-blocking)
        for (const update of loserUpdates) {
            try {
                await Notification_1.NotificationModel.create({
                    user_id: update.userId,
                    notification_type: "trade_executed",
                    title: "Position Resolved",
                    message: `Your position resolved unfavorably. Loss: ${Math.abs(update.realizedPnl) / 1000000} USDC.`,
                    entity_type: "option",
                    entity_id: optionId,
                    metadata: {
                        market_id: marketId,
                        payout: 0,
                        winning_side: winningSide === 1 ? "yes" : "no",
                        realized_pnl: update.realizedPnl,
                        auto_credited: true,
                        is_loss: true,
                    },
                });
                await Activity_1.ActivityModel.create({
                    user_id: update.userId,
                    activity_type: "market_resolved",
                    entity_type: "option",
                    entity_id: optionId,
                    metadata: {
                        payout: 0,
                        winning_side: winningSide === 1 ? "yes" : "no",
                        realized_pnl: update.realizedPnl,
                        market_id: marketId,
                        auto_credited: true,
                        is_loss: true,
                    },
                });
            }
            catch (notifError) {
                console.error(`[ResolutionProcessor] Error creating notification for user ${update.userId}:`, notifError);
            }
        }
        console.log(`[ResolutionProcessor] Processed ${winnerUpdates.length} winners and ${loserUpdates.length} losers for option ${optionId}`);
    }
    /**
     * Auto-resolve markets when all options are resolved
     */
    async autoResolveMarkets() {
        const client = await db_1.pool.connect();
        try {
            await client.query("BEGIN");
            // Find markets where all options are resolved but market is not yet resolved
            // First, identify market IDs that meet the criteria (no FOR UPDATE here due to GROUP BY)
            const marketIdsResult = await client.query(`SELECT o.market_id
         FROM market_options o
         JOIN markets m ON m.id = o.market_id
         WHERE m.is_resolved = FALSE
           AND m.status != 'RESOLVED'
         GROUP BY o.market_id
         HAVING COUNT(CASE WHEN o.is_resolved = TRUE THEN 1 END) = COUNT(o.id)
            AND COUNT(o.id) > 0
         LIMIT 10`);
            const marketIds = marketIdsResult.rows.map((row) => row.market_id);
            if (marketIds.length === 0) {
                await client.query("COMMIT");
                return;
            }
            // Now lock and select those specific markets
            const marketsResult = await client.query(`SELECT id, resolved_options
         FROM markets
         WHERE id = ANY($1::uuid[])
         FOR UPDATE SKIP LOCKED`, [marketIds]);
            const markets = marketsResult.rows;
            if (markets.length === 0) {
                await client.query("COMMIT");
                return;
            }
            console.log(`[ResolutionProcessor] Auto-resolving ${markets.length} markets`);
            for (const market of markets) {
                try {
                    await client.query(`UPDATE markets 
             SET is_resolved = TRUE, 
                 status = $1,
                 updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
             WHERE id = $2`, [Resolution_1.MarketStatus.RESOLVED, market.id]);
                    console.log(`[ResolutionProcessor] Auto-resolved market ${market.id}`);
                }
                catch (error) {
                    console.error(`[ResolutionProcessor] Error auto-resolving market ${market.id}:`, error.message);
                    // Continue with other markets
                }
            }
            await client.query("COMMIT");
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    }
}
let processorInstance = null;
const startResolutionProcessor = () => {
    if (process.env.NODE_ENV === "test") {
        console.log("[ResolutionProcessor] Disabled in test environment");
        return null;
    }
    if (processorInstance) {
        return processorInstance;
    }
    const pollIntervalMs = Number(process.env.RESOLUTION_POLL_INTERVAL_MS) || DEFAULT_POLL_INTERVAL_MS;
    processorInstance = new ResolutionProcessor(pollIntervalMs);
    processorInstance.start();
    return processorInstance;
};
exports.startResolutionProcessor = startResolutionProcessor;
//# sourceMappingURL=resolutionProcessor.js.map