"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disputeResolution = exports.getResolution = exports.submitResolution = void 0;
const Market_1 = require("../models/Market");
const Moodring_1 = require("../models/Moodring");
const Option_1 = require("../models/Option");
const Wallet_1 = require("../models/Wallet");
const Resolution_1 = require("../models/Resolution");
const Dispute_1 = require("../models/Dispute");
const resolutionEngine_1 = require("../services/resolutionEngine");
const transaction_1 = require("../utils/transaction");
const errors_1 = require("../utils/errors");
const validation_1 = require("../utils/validation");
const db_1 = require("../db");
const Activity_1 = require("../models/Activity");
const Notification_1 = require("../models/Notification");
const evidenceValidation_1 = require("../utils/evidenceValidation");
const Resolution_2 = require("../models/Resolution");
const json_1 = require("../utils/json");
/**
 * Auto-credit winnings to all winners when an option is resolved
 * This runs asynchronously after the resolution transaction commits
 * to avoid blocking the resolution process
 */
async function autoCreditWinnings(optionId, winningSide, marketId, originalClient) {
    // Use a new connection to avoid transaction conflicts
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        // Get ALL positions for this option that haven't been claimed (both winners and losers)
        const positionsResult = await client.query(`SELECT up.*, w.id as wallet_id
       FROM user_positions up
       JOIN wallets w ON w.user_id = up.user_id
       WHERE up.option_id = $1 
         AND up.is_claimed = FALSE
         AND (up.yes_shares > 0 OR up.no_shares > 0)
       FOR UPDATE`, [optionId]);
        const positions = positionsResult.rows;
        if (positions.length === 0) {
            await client.query("COMMIT");
            return; // No positions to process
        }
        // Get market data to check pool liquidity
        const marketResult = await client.query(`SELECT shared_pool_liquidity, base_liquidity_parameter FROM markets WHERE id = $1 FOR UPDATE`, [marketId]);
        const marketData = marketResult.rows[0];
        if (!marketData) {
            await client.query("ROLLBACK");
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
                    console.warn(`Insufficient pool liquidity for auto-credit. User ${position.user_id} will need to claim manually.`);
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
        await client.query("COMMIT");
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
                console.error(`Error creating notification for user ${update.userId}:`, notifError);
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
                console.error(`Error creating notification for user ${update.userId}:`, notifError);
            }
        }
        console.log(`Auto-processed ${winnerUpdates.length} winners and ${loserUpdates.length} losers for option ${optionId}`);
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Error in autoCreditWinnings:", error);
        throw error;
    }
    finally {
        client.release();
    }
}
/**
 * @route POST /api/resolution/submit
 * @desc Submit a resolution for a market
 * @access Private
 */
const submitResolution = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { marketId, outcome, optionId, winningSide, evidence, signature } = req.body;
        // Validate required fields - optionId is now required
        const validation = (0, validation_1.validateFields)([
            (0, validation_1.validateRequired)(marketId, "Market ID"),
            (0, validation_1.validateRequired)(outcome, "Outcome"),
            (0, validation_1.validateRequired)(optionId, "Option ID"),
        ]);
        if (!validation.isValid) {
            return (0, errors_1.sendValidationError)(res, validation.error);
        }
        const submission = await (0, transaction_1.withTransaction)(async (client) => {
            // SECURITY FIX: Get market with FOR UPDATE lock to prevent race conditions
            // This ensures only one resolution submission per market at a time
            const marketResult = await client.query(`SELECT * FROM markets WHERE id = $1 FOR UPDATE`, [marketId]);
            if (marketResult.rows.length === 0) {
                throw new transaction_1.TransactionError(404, "Market not found");
            }
            const market = marketResult.rows[0];
            // Check if market is in resolving state
            if (market.status !== Resolution_1.MarketStatus.RESOLVING &&
                market.status !== Resolution_1.MarketStatus.OPEN) {
                throw new transaction_1.TransactionError(400, `Market is not accepting resolutions (status: ${market.status})`);
            }
            // Validate the option exists and isn't already resolved
            const option = await Option_1.OptionModel.findById(optionId, client);
            if (!option) {
                throw new transaction_1.TransactionError(404, "Option not found");
            }
            if (option.market_id !== marketId) {
                throw new transaction_1.TransactionError(400, "Option does not belong to this market");
            }
            if (option.is_resolved) {
                throw new transaction_1.TransactionError(400, "Option is already resolved");
            }
            // Validate that the outcome matches the option label
            if (outcome !== option.option_label) {
                throw new transaction_1.TransactionError(400, `Outcome must match the option label: ${option.option_label}`);
            }
            // Check authorization based on resolution mode
            const isCreator = market.creator_id === userId;
            const isAdmin = await Moodring_1.MoodringAdminModel.isAdmin(userId, client);
            // Determine effective resolution mode (legacy markets without resolution_mode are treated as AUTHORITY)
            const effectiveResolutionMode = market.resolution_mode || Resolution_1.ResolutionMode.AUTHORITY;
            // SECURITY FIX (CVE-001): Validate evidence before processing
            const evidenceValidation = (0, evidenceValidation_1.validateEvidence)(evidence, effectiveResolutionMode);
            if (!evidenceValidation.isValid) {
                throw new transaction_1.TransactionError(400, evidenceValidation.error);
            }
            // Authorization rules:
            // - ORACLE: only platform admins can resolve
            // - AUTHORITY: creator or admin can resolve
            // - OPINION: anyone can resolve if market expiration has passed
            // - Legacy (no resolution_mode): treated as AUTHORITY (creator or admin)
            if (effectiveResolutionMode === Resolution_1.ResolutionMode.ORACLE) {
                if (!isAdmin) {
                    throw new transaction_1.TransactionError(403, "You are not authorized to resolve this market. Only platform admins can resolve ORACLE mode markets.");
                }
            }
            else if (effectiveResolutionMode === Resolution_1.ResolutionMode.AUTHORITY ||
                !market.resolution_mode) {
                // For AUTHORITY mode or legacy markets, allow creator or admin
                if (!isCreator && !isAdmin) {
                    throw new transaction_1.TransactionError(403, "You are not authorized to resolve this market. Only the market creator or admin can resolve this market.");
                }
            }
            else if (effectiveResolutionMode === Resolution_1.ResolutionMode.OPINION) {
                // For OPINION, anyone can resolve if market expiration has passed
                const now = Math.floor(Date.now() / 1000);
                if (market.expiration_timestamp > now) {
                    throw new transaction_1.TransactionError(400, "Market expiration date has not passed. OPINION mode markets can only be resolved after expiration.");
                }
            }
            // SECURITY FIX (CVE-001): Check if market requires multi-admin approval
            const marketVolume = Number(market.total_volume || 0);
            const requiresApproval = (0, evidenceValidation_1.requiresMultiAdminApproval)(marketVolume);
            const evidenceHash = evidenceValidation.evidenceHash || (0, evidenceValidation_1.calculateEvidenceHash)(evidence);
            // SECURITY FIX (CVE-001): Create submission with evidence validation fields
            const submission = await client.query(`INSERT INTO resolution_submissions (
          market_id, user_id, outcome, evidence, signature, 
          evidence_hash, evidence_source, evidence_timestamp, requires_approval, submitted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`, [
                marketId,
                userId,
                outcome,
                (0, json_1.prepareJsonb)(evidence),
                signature || null,
                evidenceHash,
                evidenceValidation.validatedSource || null,
                evidenceValidation.timestamp || null,
                requiresApproval,
                Math.floor(Date.now() / 1000),
            ]);
            const submissionRecord = {
                ...submission.rows[0],
                evidence: (0, json_1.parseJsonb)(submission.rows[0].evidence),
            };
            // SECURITY FIX (CVE-001): If multi-admin approval required, create approval record
            // and check if we have enough approvals
            if (requiresApproval && isAdmin) {
                // Create approval record for this admin
                await Resolution_2.ResolutionApprovalModel.create({
                    market_id: marketId,
                    submission_id: submissionRecord.id,
                    admin_user_id: userId,
                    approved: true,
                    evidence_hash: evidenceHash,
                }, client);
                // Check if we have enough approvals (need at least 2)
                const approvalCount = await Resolution_2.ResolutionApprovalModel.countApprovals(submissionRecord.id, client);
                if (approvalCount < 2) {
                    // Not enough approvals yet, return submission but don't resolve
                    return {
                        submission: submissionRecord,
                        resolved: false,
                        requiresApproval: true,
                        approvalCount,
                        neededApprovals: 2,
                    };
                }
            }
            else if (requiresApproval && !isAdmin) {
                // Non-admin trying to resolve large market - needs admin approval first
                throw new transaction_1.TransactionError(403, "This market requires multi-admin approval. Please contact platform admins.");
            }
            // Update market status to RESOLVING if not already
            if (market.status === Resolution_1.MarketStatus.OPEN) {
                await Market_1.MarketModel.update(marketId, { status: Resolution_1.MarketStatus.RESOLVING }, client);
            }
            // SECURITY FIX (CVE-001): If approval required and not enough approvals, don't resolve
            if (requiresApproval) {
                const approvalCount = await Resolution_2.ResolutionApprovalModel.countApprovals(submissionRecord.id, client);
                if (approvalCount < 2) {
                    // Return early - need more approvals
                    return {
                        submission: submissionRecord,
                        resolved: false,
                        requiresApproval: true,
                        approvalCount,
                        neededApprovals: 2,
                    };
                }
            }
            // Process the submission and resolve the option
            // If winningSide is explicitly provided, use it; otherwise use resolution engine
            let resolvedWinningSide;
            let resolutionTrace;
            if (winningSide !== undefined &&
                (winningSide === 1 || winningSide === 2)) {
                // Use explicitly provided winning side (for AUTHORITY mode or direct resolution)
                resolvedWinningSide = winningSide;
                resolutionTrace = {
                    mode: market.resolution_mode,
                    note: `Option resolved with explicit winning side: ${winningSide === 1 ? "YES" : "NO"}`,
                    submission_id: submissionRecord.id,
                    evidence: submissionRecord.evidence,
                    evidence_hash: evidenceHash,
                    winning_side_provided: true,
                };
            }
            else {
                // Use resolution engine logic
                const allSubmissions = await Resolution_2.ResolutionSubmissionModel.findByMarket(marketId, client);
                const optionSubmissions = allSubmissions.filter((s) => s.outcome === option.option_label);
                if (optionSubmissions.length > 0 && market.resolution_mode) {
                    // Use resolution engine to determine outcome (only for new resolution modes)
                    const outcomes = [option.option_label];
                    const resolutionResult = resolutionEngine_1.ResolutionEngine.resolveMarket({
                        id: market.id,
                        question: market.question,
                        resolution_mode: market.resolution_mode,
                        outcomes,
                    }, optionSubmissions);
                    resolvedWinningSide =
                        resolutionResult.final_outcome === option.option_label ? 1 : 2;
                    resolutionTrace = {
                        ...resolutionResult.resolution_trace,
                        evidence_hash: evidenceHash,
                    };
                }
                else {
                    // Default: if submission says this option, it wins (YES)
                    // For legacy markets or single submissions, use explicit winningSide if provided, otherwise default to YES
                    resolvedWinningSide = 1; // YES wins
                    resolutionTrace = {
                        mode: market.resolution_mode || "AUTHORITY",
                        note: "Option resolved based on submission",
                        submission_id: submissionRecord.id,
                        evidence: submissionRecord.evidence,
                        evidence_hash: evidenceHash,
                    };
                }
            }
            // Set dispute deadline (2 hours from now)
            const disputeWindowHours = 2;
            const disputeDeadline = Math.floor(Date.now() / 1000) + disputeWindowHours * 60 * 60;
            // Resolve the option
            const resolutionReason = market.resolution_mode
                ? `Resolved via ${market.resolution_mode} mode based on submission`
                : "Resolved by authorized resolver";
            await Option_1.OptionModel.update(optionId, {
                is_resolved: true,
                winning_side: resolvedWinningSide,
                resolved_at: Math.floor(Date.now() / 1000),
                resolved_reason: resolutionReason,
                resolved_by: userId,
                dispute_deadline: disputeDeadline,
            }, client);
            // Update market resolved_options count
            const allOptions = await Option_1.OptionModel.findByMarketId(marketId, client);
            const resolvedCount = allOptions.filter((opt) => opt.is_resolved).length;
            await Market_1.MarketModel.update(marketId, { resolved_options: resolvedCount }, client);
            // Check if all options are resolved, then mark market as resolved
            if (resolvedCount === allOptions.length) {
                await Market_1.MarketModel.update(marketId, {
                    is_resolved: true,
                    status: Resolution_1.MarketStatus.RESOLVED,
                }, client);
            }
            return {
                submission: submissionRecord,
                resolved: true,
                option: await Option_1.OptionModel.findById(optionId, client),
                resolution_trace: resolutionTrace,
                winningSide: resolvedWinningSide,
                marketId,
            };
        });
        // SECURITY FIX (CVE-001): If approval required and not enough approvals, return early
        if (submission.requiresApproval && !submission.resolved) {
            return (0, errors_1.sendSuccess)(res, {
                submission: submission.submission,
                message: `Resolution submitted. Requires ${submission.neededApprovals} admin approvals. Current: ${submission.approvalCount}/${submission.neededApprovals}`,
                requiresApproval: true,
                approvalCount: submission.approvalCount,
                neededApprovals: submission.neededApprovals,
            });
        }
        // Auto-credit winnings to all winners (non-blocking, runs after commit)
        // This improves UX by automatically crediting balances when options resolve
        // Note: autoCreditWinnings creates its own client connection, so we pass null
        if (submission.resolved && submission.winningSide) {
            autoCreditWinnings(optionId, submission.winningSide, submission.marketId, null).catch((error) => {
                console.error("Error auto-crediting winnings:", error);
                // Don't fail the resolution if auto-credit fails - users can still manually claim
            });
        }
        // Record activity
        const marketForActivity = await Market_1.MarketModel.findById(marketId);
        await Activity_1.ActivityModel.create({
            user_id: userId,
            activity_type: "market_resolved",
            entity_type: "option",
            entity_id: optionId,
            metadata: {
                market_id: marketId,
                winning_side: submission.winningSide === 1 ? "yes" : "no",
                resolution_mode: marketForActivity?.resolution_mode || "AUTHORITY",
            },
        });
        return (0, errors_1.sendSuccess)(res, { submission: submission.submission });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Submit resolution error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.submitResolution = submitResolution;
/**
 * @route GET /api/resolution/:marketId
 * @desc Get resolution information for a market
 * @access Public
 */
const getResolution = async (req, res) => {
    try {
        const { marketId } = req.params;
        const market = await Market_1.MarketModel.findById(marketId);
        if (!market) {
            return (0, errors_1.sendNotFound)(res, "Market");
        }
        const resolution = await Resolution_1.MarketResolutionModel.findByMarket(marketId);
        const submissions = await Resolution_2.ResolutionSubmissionModel.findByMarket(marketId);
        return (0, errors_1.sendSuccess)(res, {
            market: {
                id: market.id,
                question: market.question,
                resolution_mode: market.resolution_mode,
                bond_amount: market.bond_amount,
                status: market.status,
            },
            resolution,
            submissions,
        });
    }
    catch (error) {
        console.error("Get resolution error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getResolution = getResolution;
/**
 * @route POST /api/resolution/dispute
 * @desc Dispute a market resolution
 * @access Private
 */
const disputeResolution = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { marketId, optionId, reason, evidence } = req.body;
        // Validate required fields
        const validation = (0, validation_1.validateFields)([
            (0, validation_1.validateRequired)(marketId, "Market ID"),
            (0, validation_1.validateRequired)(optionId, "Option ID"),
            (0, validation_1.validateRequired)(reason, "Reason"),
        ]);
        if (!validation.isValid) {
            return (0, errors_1.sendValidationError)(res, validation.error);
        }
        // Fixed dispute resolution fee: $100 USDC
        const DISPUTE_RESOLUTION_FEE_MICROUSDC = 100 * 1000000;
        await (0, transaction_1.withTransaction)(async (client) => {
            const market = await Market_1.MarketModel.findById(marketId, client);
            if (!market) {
                throw new transaction_1.TransactionError(404, "Market not found");
            }
            // Get the specific option being disputed
            const option = await Option_1.OptionModel.findById(optionId, client);
            if (!option) {
                throw new transaction_1.TransactionError(404, "Option not found");
            }
            if (option.market_id !== marketId) {
                throw new transaction_1.TransactionError(400, "Option does not belong to this market");
            }
            // Only resolved options can be disputed
            if (!option.is_resolved) {
                throw new transaction_1.TransactionError(400, "Only resolved options can be disputed");
            }
            // Check if dispute deadline has passed for this specific option
            // Dispute window is always exactly 2 hours from when resolution began
            if (!option.dispute_deadline) {
                throw new transaction_1.TransactionError(400, "This option does not have a dispute deadline (OPINION mode options cannot be disputed)");
            }
            if (option.dispute_deadline > 0 &&
                option.dispute_deadline < Math.floor(Date.now() / 1000)) {
                throw new transaction_1.TransactionError(400, "Dispute deadline has passed for this option");
            }
            // Get user wallet and check balance
            const wallet = await Wallet_1.WalletModel.findByUserId(userId, client);
            if (!wallet) {
                throw new transaction_1.TransactionError(404, "Wallet not found");
            }
            // Check sufficient balance for resolution fee
            if (Number(wallet.balance_usdc) < DISPUTE_RESOLUTION_FEE_MICROUSDC) {
                throw new transaction_1.TransactionError(400, `Insufficient USDC balance. Dispute resolution requires a $100 USDC fee.`);
            }
            // Deduct resolution fee from user's wallet
            await client.query(`UPDATE wallets SET balance_usdc = balance_usdc - $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`, [DISPUTE_RESOLUTION_FEE_MICROUSDC, wallet.id]);
            // Record the resolution fee as protocol fee (platform keeps it)
            // Pass 0 for creator fees since this is purely a platform fee
            await Moodring_1.MoodringModel.recordFees(0, DISPUTE_RESOLUTION_FEE_MICROUSDC, client);
            // Create dispute record with reason and evidence
            await Dispute_1.DisputeModel.create({
                market_id: marketId,
                option_id: optionId,
                user_id: userId,
                reason,
                evidence: evidence || null,
                resolution_fee_paid: DISPUTE_RESOLUTION_FEE_MICROUSDC,
            }, client);
            // Update market status to DISPUTED
            await Market_1.MarketModel.update(marketId, { status: Resolution_1.MarketStatus.DISPUTED }, client);
        });
        return (0, errors_1.sendSuccess)(res, {
            message: "Dispute submitted. Market status updated to DISPUTED",
            resolutionFee: DISPUTE_RESOLUTION_FEE_MICROUSDC,
        });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Dispute resolution error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.disputeResolution = disputeResolution;
//# sourceMappingURL=controller_resolution.js.map