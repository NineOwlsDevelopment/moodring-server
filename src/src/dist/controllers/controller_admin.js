"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDispute = exports.getDispute = exports.getDisputes = exports.toggleUserAdmin = exports.getUserSuspiciousTrades = exports.reviewSuspiciousTrade = exports.getSuspiciousTradesStats = exports.getSuspiciousTrades = exports.getAdminSettingsGroup = exports.updateAdminSettings = exports.getAdminSettings = exports.withdrawToColdStorage = exports.createCircleHotWallet = exports.getHotWalletStatus = exports.approveBalanceAdjustment = exports.adjustUserBalance = exports.getUsers = exports.getAdminStats = exports.getPendingWithdrawals = exports.processWithdrawal = exports.updateMarketCategories = exports.toggleMarketVerified = exports.toggleMarketFeatured = exports.deleteCategory = exports.getCategories = exports.createCategory = exports.withdrawProtocolFees = exports.getProtocolFees = exports.getPauseFlags = exports.setPauseFlags = void 0;
const web3_js_1 = require("@solana/web3.js");
const db_1 = require("../db");
const Category_1 = require("../models/Category");
const Moodring_1 = require("../models/Moodring");
const SuspiciousTrade_1 = require("../models/SuspiciousTrade");
const Wallet_1 = require("../models/Wallet");
const circleWallet_1 = require("../services/circleWallet");
const transaction_1 = require("../utils/transaction");
const errors_1 = require("../utils/errors");
const validation_1 = require("../utils/validation");
const json_1 = require("../utils/json");
const Dispute_1 = require("../models/Dispute");
/**
 * @route POST /api/admin/pause
 * @desc Set platform pause trading flag
 * @access Admin
 */
const setPauseFlags = async (req, res) => {
    try {
        const { pauseTrading } = req.body;
        // Update pause_trading in moodring table
        await db_1.pool.query(`UPDATE moodring SET pause_trading = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT`, [pauseTrading ?? false]);
        return (0, errors_1.sendSuccess)(res, { message: "Pause flag updated successfully" });
    }
    catch (error) {
        console.error("Set pause flags error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.setPauseFlags = setPauseFlags;
/**
 * @route GET /api/admin/pause
 * @desc Get platform pause flags
 * @access Admin
 */
const getPauseFlags = async (req, res) => {
    try {
        const result = await db_1.pool.query(`SELECT pause_trading FROM moodring LIMIT 1`);
        const flags = {
            pause_trading: result.rows[0]?.pause_trading ?? false,
        };
        return (0, errors_1.sendSuccess)(res, { flags });
    }
    catch (error) {
        console.error("Get pause flags error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getPauseFlags = getPauseFlags;
/**
 * @route GET /api/admin/fees
 * @desc Get collected protocol fees with lifetime tracking
 * @access Admin
 */
const getProtocolFees = async (req, res) => {
    try {
        // Get fee tracking from moodring table
        const moodringResult = await db_1.pool.query(`
      SELECT 
        lifetime_protocol_fees_earned,
        current_protocol_fees_balance,
        total_protocol_fees_withdrawn
      FROM moodring
      LIMIT 1
    `);
        // Also get market-level fees for reference
        const marketFeesResult = await db_1.pool.query(`
      SELECT 
        COALESCE(SUM(protocol_fees_collected), 0)::bigint as total_protocol_fees,
        COALESCE(SUM(creator_fees_collected), 0)::bigint as total_creator_fees,
        COALESCE(SUM(accumulated_lp_fees), 0)::bigint as total_lp_fees
      FROM markets
    `);
        const moodring = moodringResult.rows[0] || {
            lifetime_protocol_fees_earned: 0,
            current_protocol_fees_balance: 0,
            total_protocol_fees_withdrawn: 0,
        };
        return (0, errors_1.sendSuccess)(res, {
            protocol_fees: {
                lifetime_earned: Number(moodring.lifetime_protocol_fees_earned || 0),
                current_balance: Number(moodring.current_protocol_fees_balance || 0),
                total_withdrawn: Number(moodring.total_protocol_fees_withdrawn || 0),
            },
            other_fees: {
                creator_fees: Number(marketFeesResult.rows[0].total_creator_fees),
                lp_fees: Number(marketFeesResult.rows[0].total_lp_fees),
            },
            // Legacy field for backwards compatibility
            fees: {
                protocol_fees: Number(moodring.current_protocol_fees_balance || 0),
                creator_fees: Number(marketFeesResult.rows[0].total_creator_fees),
                lp_fees: Number(marketFeesResult.rows[0].total_lp_fees),
            },
        });
    }
    catch (error) {
        console.error("Get protocol fees error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getProtocolFees = getProtocolFees;
/**
 * @route POST /api/admin/fees/withdraw
 * @desc Withdraw protocol fees to admin wallet (treasury)
 * @access Admin
 */
const withdrawProtocolFees = async (req, res) => {
    try {
        const adminUserId = req.id;
        const { amount: requestedAmount } = req.body; // Optional: specific amount, or withdraw all
        const result = await (0, transaction_1.withTransaction)(async (client) => {
            // Get current protocol fees balance from moodring table
            const moodringResult = await client.query(`
        SELECT current_protocol_fees_balance, lifetime_protocol_fees_earned
        FROM moodring
        FOR UPDATE
        LIMIT 1
      `);
            if (!moodringResult.rows[0]) {
                throw new transaction_1.TransactionError(404, "Moodring config not found");
            }
            const currentBalance = Number(moodringResult.rows[0].current_protocol_fees_balance || 0);
            // Determine withdrawal amount
            const withdrawalAmount = requestedAmount
                ? Math.min(Number(requestedAmount), currentBalance)
                : currentBalance;
            if (withdrawalAmount <= 0) {
                throw new transaction_1.TransactionError(400, "No fees available to withdraw", {
                    current_balance: currentBalance,
                });
            }
            if (withdrawalAmount > currentBalance) {
                throw new transaction_1.TransactionError(400, "Insufficient balance", {
                    requested: withdrawalAmount,
                    available: currentBalance,
                });
            }
            // Record withdrawal in moodring table (deducts from current balance, keeps lifetime total)
            await Moodring_1.MoodringModel.recordProtocolFeeWithdrawal(withdrawalAmount, client);
            // Reset protocol fees on all markets (for consistency, even though we track in moodring now)
            await client.query(`
        UPDATE markets 
        SET protocol_fees_collected = 0, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
        WHERE protocol_fees_collected > 0
      `);
            // Add to admin wallet (treasury)
            await client.query(`UPDATE wallets SET balance_usdc = balance_usdc + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
         WHERE user_id = $2`, [withdrawalAmount, adminUserId]);
            return withdrawalAmount;
        });
        // Get updated balance
        const updatedMoodring = await Moodring_1.MoodringModel.get();
        const newBalance = updatedMoodring?.current_protocol_fees_balance || 0;
        return (0, errors_1.sendSuccess)(res, {
            message: "Protocol fees withdrawn successfully",
            amount: result,
            current_balance: newBalance,
            lifetime_earned: updatedMoodring?.lifetime_protocol_fees_earned || 0,
            total_withdrawn: updatedMoodring?.total_protocol_fees_withdrawn || 0,
        });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Withdraw protocol fees error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.withdrawProtocolFees = withdrawProtocolFees;
/**
 * @route POST /api/admin/categories
 * @desc Create a new category
 * @access Admin
 */
const createCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const nameValidation = (0, validation_1.validateLength)(name?.trim(), "Category name", 1, 255);
        if (!nameValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, nameValidation.error);
        }
        const normalizedName = name.trim();
        const existingCategory = await Category_1.CategoryModel.findByName(normalizedName);
        if (existingCategory) {
            return (0, errors_1.sendError)(res, 409, "Category already exists");
        }
        const category = await Category_1.CategoryModel.create({ name: normalizedName });
        return (0, errors_1.sendSuccess)(res, {
            message: "Category created successfully",
            category,
        }, 201);
    }
    catch (error) {
        console.error("Create category error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.createCategory = createCategory;
/**
 * @route GET /api/admin/categories
 * @desc Get all categories
 * @access Admin
 */
const getCategories = async (req, res) => {
    try {
        const categories = await Category_1.CategoryModel.findAll();
        return (0, errors_1.sendSuccess)(res, { categories });
    }
    catch (error) {
        console.error("Get categories error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getCategories = getCategories;
/**
 * @route DELETE /api/admin/categories/:id
 * @desc Delete a category
 * @access Admin
 */
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Category_1.CategoryModel.delete(id);
        if (!deleted) {
            return (0, errors_1.sendNotFound)(res, "Category");
        }
        return (0, errors_1.sendSuccess)(res, { message: "Category deleted successfully" });
    }
    catch (error) {
        console.error("Delete category error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.deleteCategory = deleteCategory;
/**
 * @route POST /api/admin/market/:id/feature
 * @desc Toggle market featured status
 * @access Admin
 */
const toggleMarketFeatured = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_featured, featured_order } = req.body;
        const result = await db_1.pool.query(`
      UPDATE markets
      SET 
        is_featured = COALESCE($1, NOT is_featured),
        featured_order = $2,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $3
      RETURNING *
    `, [is_featured, featured_order || null, id]);
        if (result.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "Market");
        }
        return (0, errors_1.sendSuccess)(res, {
            message: "Market featured status updated",
            market: result.rows[0],
        });
    }
    catch (error) {
        console.error("Toggle market featured error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.toggleMarketFeatured = toggleMarketFeatured;
/**
 * @route POST /api/admin/market/:id/verify
 * @desc Toggle market verified status
 * @access Admin
 */
const toggleMarketVerified = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_verified } = req.body;
        const result = await db_1.pool.query(`
      UPDATE markets
      SET 
        is_verified = COALESCE($1, NOT is_verified),
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $2
      RETURNING *
    `, [is_verified, id]);
        if (result.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "Market");
        }
        return (0, errors_1.sendSuccess)(res, {
            message: "Market verified status updated",
            market: result.rows[0],
        });
    }
    catch (error) {
        console.error("Toggle market verified error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.toggleMarketVerified = toggleMarketVerified;
/**
 * @route POST /api/admin/market/:id/categories
 * @desc Update market categories
 * @access Admin
 */
const updateMarketCategories = async (req, res) => {
    try {
        const { id } = req.params;
        const { category_ids } = req.body;
        if (!Array.isArray(category_ids)) {
            return (0, errors_1.sendValidationError)(res, "category_ids must be an array");
        }
        // Verify market exists
        const marketResult = await db_1.pool.query("SELECT id FROM markets WHERE id = $1", [id]);
        if (marketResult.rows.length === 0) {
            return (0, errors_1.sendNotFound)(res, "Market");
        }
        // Update categories
        const { MarketModel } = require("../models/Market");
        await MarketModel.setCategories(id, category_ids);
        // Get updated categories
        const categories = await MarketModel.getCategories(id);
        return (0, errors_1.sendSuccess)(res, {
            message: "Market categories updated",
            categories,
        });
    }
    catch (error) {
        console.error("Update market categories error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.updateMarketCategories = updateMarketCategories;
/**
 * @route POST /api/admin/withdrawal/:id/process
 * @desc Process a pending withdrawal (admin marks it as completed)
 * @access Admin
 */
const processWithdrawal = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, transaction_signature, failure_reason } = req.body;
        const statusValidation = (0, validation_1.validateEnum)(status, "Status", [
            "completed",
            "failed",
        ]);
        if (!statusValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, statusValidation.error);
        }
        const withdrawal = await (0, transaction_1.withTransaction)(async (client) => {
            // Get withdrawal with lock
            const withdrawalResult = await client.query(`SELECT * FROM withdrawals WHERE id = $1 AND status = 'pending' FOR UPDATE`, [id]);
            if (withdrawalResult.rows.length === 0) {
                throw new transaction_1.TransactionError(404, "Withdrawal not found or not pending");
            }
            const withdrawal = withdrawalResult.rows[0];
            // Update withdrawal status
            await client.query(`UPDATE withdrawals
         SET 
           status = $1,
           transaction_signature = $2,
           failure_reason = $3,
           updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
         WHERE id = $4`, [status, transaction_signature || null, failure_reason || null, id]);
            // If failed, refund the user using explicit column names
            if (status === "failed") {
                if (withdrawal.token_symbol === "SOL") {
                    await client.query(`UPDATE wallets SET balance_sol = balance_sol + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
             WHERE id = $2`, [withdrawal.amount, withdrawal.wallet_id]);
                }
                else {
                    await client.query(`UPDATE wallets SET balance_usdc = balance_usdc + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
             WHERE id = $2`, [withdrawal.amount, withdrawal.wallet_id]);
                }
            }
            return { ...withdrawal, status };
        });
        return (0, errors_1.sendSuccess)(res, {
            message: `Withdrawal ${status}`,
            withdrawal,
        });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Process withdrawal error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.processWithdrawal = processWithdrawal;
/**
 * @route GET /api/admin/withdrawals/pending
 * @desc Get all pending withdrawals
 * @access Admin
 */
const getPendingWithdrawals = async (req, res) => {
    try {
        const result = await db_1.pool.query(`
      SELECT w.*, u.email, u.username
      FROM withdrawals w
      LEFT JOIN users u ON w.user_id = u.id
      WHERE w.status = 'pending'
      ORDER BY w.created_at ASC
    `);
        return (0, errors_1.sendSuccess)(res, { withdrawals: result.rows });
    }
    catch (error) {
        console.error("Get pending withdrawals error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getPendingWithdrawals = getPendingWithdrawals;
/**
 * @route GET /api/admin/stats
 * @desc Get admin dashboard stats
 * @access Admin
 */
const getAdminStats = async (req, res) => {
    try {
        const [usersResult, marketsResult, tradesResult, pendingWithdrawals] = await Promise.all([
            db_1.pool.query(`
        SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE created_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours')::BIGINT)::int as new_24h,
          COUNT(*) FILTER (WHERE created_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days')::BIGINT)::int as new_7d
        FROM users
      `),
            db_1.pool.query(`
        SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE is_resolved = FALSE AND is_initialized = TRUE)::int as active,
          COUNT(*) FILTER (WHERE is_resolved = TRUE)::int as resolved,
          COUNT(*) FILTER (WHERE is_featured = TRUE)::int as featured
        FROM markets
      `),
            db_1.pool.query(`
        SELECT 
          COUNT(*)::int as total,
          COALESCE(SUM(total_cost), 0)::bigint as total_volume,
          COUNT(*) FILTER (WHERE created_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours')::BIGINT)::int as trades_24h,
          COALESCE(SUM(total_cost) FILTER (WHERE created_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours')::BIGINT), 0)::bigint as volume_24h
        FROM trades
        WHERE status = 'completed'
      `),
            db_1.pool.query(`
        SELECT COUNT(*)::int as count
        FROM withdrawals
        WHERE status IN ('pending', 'processing')
      `),
        ]);
        return (0, errors_1.sendSuccess)(res, {
            users: usersResult.rows[0],
            markets: marketsResult.rows[0],
            trades: tradesResult.rows[0],
            pending_withdrawals: pendingWithdrawals.rows[0].count,
        });
    }
    catch (error) {
        console.error("Get admin stats error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getAdminStats = getAdminStats;
/**
 * @route GET /api/admin/users
 * @desc Get users with pagination
 * @access Admin
 */
const getUsers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const offset = (page - 1) * limit;
        const search = req.query.search;
        let whereClause = "";
        const values = [];
        let paramCount = 1;
        if (search) {
            whereClause = `WHERE username ILIKE $${paramCount} OR email ILIKE $${paramCount}`;
            values.push(`%${search}%`);
            paramCount++;
        }
        const [usersResult, countResult] = await Promise.all([
            db_1.pool.query(`
        SELECT u.id, u.email, u.username, u.display_name, u.created_at, u.updated_at,
          w.public_key as wallet_public_key, w.balance_sol, w.balance_usdc,
          CASE WHEN ma.user_id IS NOT NULL THEN true ELSE false END as is_admin
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        LEFT JOIN moodring_admins ma ON u.id = ma.user_id
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `, [...values, limit, offset]),
            db_1.pool.query(`SELECT COUNT(*)::int as count FROM users ${whereClause}`, values),
        ]);
        const total = countResult.rows[0]?.count || 0;
        const totalPages = Math.ceil(total / limit);
        return (0, errors_1.sendSuccess)(res, {
            users: usersResult.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            },
        });
    }
    catch (error) {
        console.error("Get users error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getUsers = getUsers;
/**
 * @route POST /api/admin/user/:id/balance
 * @desc Request a balance adjustment (requires multi-admin approval for large amounts)
 * @access Admin
 */
const adjustUserBalance = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, token_symbol, reason } = req.body;
        const adminUserId = req.id;
        const amountValidation = (0, validation_1.validateNumber)(amount, "Amount", undefined, undefined);
        if (!amountValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, amountValidation.error);
        }
        const tokenValidation = (0, validation_1.validateEnum)(token_symbol, "Token symbol", [
            "SOL",
            "USDC",
        ]);
        if (!tokenValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, tokenValidation.error);
        }
        const parsedAmount = Number(amount);
        const absAmount = Math.abs(parsedAmount);
        // Security: Require multi-admin approval for large adjustments
        const MAX_SINGLE_ADMIN_AMOUNT = 10000000; // 10 USDC in micro-units
        const REQUIRED_APPROVALS = 2; // Require 2 admins for large amounts
        const EXPIRY_HOURS = 24; // Request expires after 24 hours
        const requiresApproval = absAmount > MAX_SINGLE_ADMIN_AMOUNT;
        if (requiresApproval) {
            // Create approval request
            const expiresAt = Math.floor(Date.now() / 1000) + EXPIRY_HOURS * 60 * 60;
            const requestResult = await db_1.pool.query(`INSERT INTO balance_adjustment_requests (
          target_user_id, requested_by, amount, token_symbol, reason,
          approvals_required, expires_at
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`, [
                id,
                adminUserId,
                parsedAmount,
                token_symbol,
                reason || "Balance adjustment",
                REQUIRED_APPROVALS,
                expiresAt,
            ]);
            return (0, errors_1.sendSuccess)(res, {
                message: "Balance adjustment request created. Requires multi-admin approval.",
                request_id: requestResult.rows[0].id,
                approvals_required: REQUIRED_APPROVALS,
                expires_at: expiresAt,
            });
        }
        // Small amounts can be executed immediately (single admin)
        // But still verify hot wallet has funds (if using Circle, check Circle balance)
        const wallet = await Wallet_1.WalletModel.findByUserId(id);
        if (!wallet) {
            return (0, errors_1.sendNotFound)(res, "Wallet");
        }
        // Verify Circle wallet has sufficient funds for positive adjustments
        if (parsedAmount > 0) {
            const circleWallet = require("../services/circleWallet").getCircleWallet();
            if (circleWallet.isAvailable() && wallet.circle_wallet_id) {
                const circleBalance = await circleWallet.getUsdcBalance(wallet.circle_wallet_id);
                // This is a rough check - in production, track total platform liabilities
                console.log(`[Balance Adjustment] Circle wallet balance: ${circleBalance}, adjustment: ${parsedAmount}`);
            }
        }
        // Execute small adjustment immediately
        const result = await (0, transaction_1.withTransaction)(async (client) => {
            // Get current balance with lock
            const walletResult = await client.query(`SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`, [id]);
            const wallet = walletResult.rows[0];
            if (!wallet) {
                throw new transaction_1.TransactionError(404, "Wallet not found");
            }
            const previousBalance = token_symbol === "USDC"
                ? Number(wallet.balance_usdc)
                : Number(wallet.balance_sol);
            if (token_symbol === "SOL") {
                await client.query(`UPDATE wallets
           SET balance_sol = balance_sol + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
           WHERE user_id = $2`, [parsedAmount, id]);
            }
            else {
                await client.query(`UPDATE wallets
           SET balance_usdc = balance_usdc + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
           WHERE user_id = $2`, [parsedAmount, id]);
            }
            const newBalance = previousBalance + parsedAmount;
            // SECURITY FIX: Log to immutable audit table
            await client.query(`INSERT INTO balance_adjustment_audit (
          target_user_id, admin_user_id, amount, token_symbol,
          reason, previous_balance, new_balance, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
                id,
                adminUserId,
                parsedAmount,
                token_symbol,
                reason || "Balance adjustment",
                previousBalance,
                newBalance,
                Math.floor(Date.now() / 1000),
            ]);
            return { previousBalance, newBalance };
        });
        if (!result) {
            return (0, errors_1.sendNotFound)(res, "Wallet");
        }
        // Also log to admin_actions for general admin logging (non-critical)
        try {
            await db_1.pool.query(`INSERT INTO admin_actions (admin_user_id, action_type, target_user_id, metadata)
         VALUES ($1, 'balance_adjustment', $2, $3)`, [
                adminUserId,
                id,
                (0, json_1.prepareJsonb)({
                    amount: parsedAmount,
                    token_symbol,
                    reason: reason || "Manual adjustment",
                    single_admin: true, // Small amount, single admin approval
                }),
            ]);
        }
        catch (error) {
            // Non-critical logging failure, don't fail the request
            console.error("Failed to log to admin_actions:", error);
        }
        return (0, errors_1.sendSuccess)(res, {
            message: "Balance adjusted successfully",
            new_balance: result.newBalance,
            previous_balance: result.previousBalance,
            adjustment: parsedAmount,
        });
    }
    catch (error) {
        console.error("Adjust user balance error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.adjustUserBalance = adjustUserBalance;
/**
 * @route POST /api/admin/balance-adjustment/:requestId/approve
 * @desc Approve a balance adjustment request (multi-admin approval)
 * @access Admin
 */
const approveBalanceAdjustment = async (req, res) => {
    try {
        const { requestId } = req.params;
        const adminUserId = req.id;
        const result = await (0, transaction_1.withTransaction)(async (client) => {
            // Get request with lock
            const requestResult = await client.query(`SELECT * FROM balance_adjustment_requests 
         WHERE id = $1 AND status = 'pending' 
         FOR UPDATE`, [requestId]);
            if (requestResult.rows.length === 0) {
                throw new transaction_1.TransactionError(404, "Request not found or not pending");
            }
            const request = requestResult.rows[0];
            // Check if expired
            if (Math.floor(Date.now() / 1000) > request.expires_at) {
                await client.query(`UPDATE balance_adjustment_requests 
           SET status = 'expired', updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
           WHERE id = $1`, [requestId]);
                throw new transaction_1.TransactionError(400, "Request has expired");
            }
            // Check if admin already approved
            if (request.approved_by && request.approved_by.includes(adminUserId)) {
                throw new transaction_1.TransactionError(400, "You have already approved this request");
            }
            // Add approval
            const approvedBy = request.approved_by || [];
            approvedBy.push(adminUserId);
            const approvalsReceived = request.approvals_received + 1;
            await client.query(`UPDATE balance_adjustment_requests 
         SET 
           approvals_received = $1,
           approved_by = $2,
           updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
         WHERE id = $3`, [approvalsReceived, approvedBy, requestId]);
            // If enough approvals, execute the adjustment
            if (approvalsReceived >= request.approvals_required) {
                const wallet = await Wallet_1.WalletModel.findByUserId(request.target_user_id, client);
                if (!wallet) {
                    throw new transaction_1.TransactionError(404, "Wallet not found");
                }
                // Execute adjustment
                if (request.token_symbol === "SOL") {
                    await client.query(`UPDATE wallets 
             SET balance_sol = balance_sol + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
             WHERE user_id = $2`, [request.amount, request.target_user_id]);
                }
                else {
                    await client.query(`UPDATE wallets 
             SET balance_usdc = balance_usdc + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
             WHERE user_id = $2`, [request.amount, request.target_user_id]);
                }
                // Mark request as approved and executed
                await client.query(`UPDATE balance_adjustment_requests 
           SET 
             status = 'approved',
             executed_at = EXTRACT(EPOCH FROM NOW())::BIGINT,
             executed_by = $1,
             updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
           WHERE id = $2`, [adminUserId, requestId]);
                // Log the adjustment
                await client.query(`INSERT INTO admin_actions (admin_user_id, action_type, target_user_id, metadata)
           VALUES ($1, 'balance_adjustment', $2, $3)`, [
                    adminUserId,
                    request.target_user_id,
                    (0, json_1.prepareJsonb)({
                        amount: request.amount,
                        token_symbol: request.token_symbol,
                        reason: request.reason,
                        multi_admin: true,
                        request_id: requestId,
                        approved_by: approvedBy,
                    }),
                ]);
            }
            return {
                request,
                approvalsReceived,
                executed: approvalsReceived >= request.approvals_required,
            };
        });
        return (0, errors_1.sendSuccess)(res, {
            message: result.executed
                ? "Balance adjustment approved and executed"
                : "Balance adjustment approved",
            approvals_received: result.approvalsReceived,
            approvals_required: result.request.approvals_required,
            executed: result.executed,
        });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Approve balance adjustment error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.approveBalanceAdjustment = approveBalanceAdjustment;
/**
 * @route GET /api/admin/hot-wallet
 * @desc Get hot wallet status and balances
 * @access Admin
 */
const getHotWalletStatus = async (req, res) => {
    try {
        const circleWallet = (0, circleWallet_1.getCircleWallet)();
        if (!circleWallet.isAvailable()) {
            return (0, errors_1.sendSuccess)(res, {
                status: "not_configured",
                message: "Circle wallet service is not available. Check CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET environment variables.",
            });
        }
        // Get hot wallet info
        const hotWalletInfo = await circleWallet.getHotWalletInfo();
        if (!hotWalletInfo) {
            return (0, errors_1.sendSuccess)(res, {
                status: "not_configured",
                message: "Hot wallet not configured. Set CIRCLE_HOT_WALLET_ID environment variable.",
            });
        }
        // Get balances
        const [usdcBalance, solBalance] = await Promise.all([
            circleWallet.getUsdcBalance(hotWalletInfo.walletId),
            circleWallet.getSolBalance(hotWalletInfo.walletId),
        ]);
        // Format balances
        const formatUsdc = (microUsdc) => {
            return (microUsdc / 1000000).toFixed(6);
        };
        const formatSol = (lamports) => {
            return (lamports / 1000000000).toFixed(9);
        };
        return (0, errors_1.sendSuccess)(res, {
            status: "operational",
            address: hotWalletInfo.address,
            balances: {
                usdc: usdcBalance,
                usdc_formatted: formatUsdc(usdcBalance),
                sol: solBalance,
                sol_formatted: formatSol(solBalance),
            },
            // Note: Liabilities calculation would require querying all user wallets
            // This is a placeholder - you may want to implement this separately
            liabilities: {
                total_usdc: 0,
                total_usdc_formatted: "0.000000",
                total_sol: 0,
                total_wallets: 0,
            },
        });
    }
    catch (error) {
        console.error("Get hot wallet status error:", error);
        return (0, errors_1.sendSuccess)(res, {
            status: "rpc_unavailable",
            message: error.message || "Failed to get hot wallet status",
        });
    }
};
exports.getHotWalletStatus = getHotWalletStatus;
/**
 * @route POST /api/admin/circle-hot-wallet
 * @desc Create a new Circle hot wallet
 * @access Admin
 */
const createCircleHotWallet = async (req, res) => {
    try {
        const { name } = req.body;
        const circleWallet = (0, circleWallet_1.getCircleWallet)();
        if (!circleWallet.isAvailable()) {
            return (0, errors_1.sendError)(res, 503, "Circle wallet service is not available. Check CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET environment variables.");
        }
        const walletResult = await circleWallet.createHotWallet(name);
        // Log the admin action
        await db_1.pool.query(`INSERT INTO admin_actions (admin_user_id, action_type, metadata)
       VALUES ($1, 'create_circle_hot_wallet', $2)`, [
            req.id,
            (0, json_1.prepareJsonb)({
                wallet_id: walletResult.walletId,
                address: walletResult.address,
                name: name || null,
            }),
        ]);
        return (0, errors_1.sendSuccess)(res, {
            message: "Circle hot wallet created successfully",
            wallet: {
                id: walletResult.walletId,
                address: walletResult.address,
                name: name || null,
            },
        }, 201);
    }
    catch (error) {
        console.error("Create Circle hot wallet error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.createCircleHotWallet = createCircleHotWallet;
/**
 * @route POST /api/admin/hot-wallet/withdraw-to-cold-storage
 * @desc Withdraw any amount from hot wallet to cold storage (requires HIGH_ORDER_TX_PW passcode)
 * @access Admin
 */
const withdrawToColdStorage = async (req, res) => {
    try {
        const adminUserId = req.id;
        const { passcode, amount, destination_address } = req.body;
        // Validate passcode matches HIGH_ORDER_TX_PW environment variable
        const requiredPasscode = process.env.HIGH_ORDER_TX_PW;
        if (!requiredPasscode) {
            return (0, errors_1.sendError)(res, 500, "HIGH_ORDER_TX_PW environment variable not configured");
        }
        if (passcode !== requiredPasscode) {
            return (0, errors_1.sendError)(res, 403, "Invalid passcode");
        }
        // Validate destination address
        try {
            new web3_js_1.PublicKey(destination_address);
        }
        catch {
            return (0, errors_1.sendValidationError)(res, "Invalid destination address");
        }
        // Validate amount
        const amountValidation = (0, validation_1.validateNumber)(amount, "Amount", 0.01, undefined);
        if (!amountValidation.isValid) {
            return (0, errors_1.sendValidationError)(res, amountValidation.error);
        }
        // Convert amount to micro-USDC (same logic as withdrawal controller)
        const amountStr = String(amount);
        const decimalIndex = amountStr.indexOf(".");
        let parsedAmount;
        if (decimalIndex === -1) {
            parsedAmount = Math.floor(Number(amountStr)) * 1000000;
        }
        else {
            const wholePart = amountStr.substring(0, decimalIndex);
            const decimalPart = amountStr.substring(decimalIndex + 1);
            if (decimalPart.length > 6) {
                return (0, errors_1.sendValidationError)(res, "Amount precision error. USDC supports up to 6 decimal places.");
            }
            const wholeMicro = Math.floor(Number(wholePart)) * 1000000;
            const decimalMicro = Math.floor(Number(decimalPart) * Math.pow(10, 6 - decimalPart.length));
            parsedAmount = wholeMicro + decimalMicro;
        }
        if (parsedAmount <= 0) {
            return (0, errors_1.sendValidationError)(res, "Amount must be greater than 0");
        }
        const circleWallet = (0, circleWallet_1.getCircleWallet)();
        if (!circleWallet.isAvailable()) {
            return (0, errors_1.sendError)(res, 503, "Circle wallet service is not available. Check CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET environment variables.");
        }
        // Get hot wallet info
        const hotWalletInfo = await circleWallet.getHotWalletInfo();
        if (!hotWalletInfo) {
            return (0, errors_1.sendError)(res, 500, "Hot wallet not configured. Set CIRCLE_HOT_WALLET_ID environment variable.");
        }
        // Get hot wallet balance
        const hotWalletBalance = await circleWallet.getUsdcBalance(hotWalletInfo.walletId);
        if (hotWalletBalance < parsedAmount) {
            return (0, errors_1.sendError)(res, 400, "Insufficient hot wallet balance", {
                available: hotWalletBalance,
                requested: parsedAmount,
                available_usdc: hotWalletBalance / 1000000,
                requested_usdc: parsedAmount / 1000000,
            });
        }
        // Convert from micro-USDC to USDC (Circle API expects base units)
        const usdcAmount = parsedAmount / 1000000;
        // Send USDC from hot wallet to cold storage
        let transactionId;
        try {
            transactionId = await circleWallet.sendUsdc(hotWalletInfo.walletId, destination_address, usdcAmount);
        }
        catch (error) {
            console.error("Failed to send USDC to cold storage:", error);
            return (0, errors_1.sendError)(res, 500, `Failed to send USDC: ${error.message || "Unknown error"}`, {
                hot_wallet_id: hotWalletInfo.walletId,
                destination_address,
                amount: usdcAmount,
            });
        }
        // Get transaction hash
        const transactionHash = await circleWallet.getTransactionHash(transactionId);
        // Log the admin action
        await db_1.pool.query(`INSERT INTO admin_actions (admin_user_id, action_type, metadata)
       VALUES ($1, 'withdraw_to_cold_storage', $2)`, [
            adminUserId,
            (0, json_1.prepareJsonb)({
                hot_wallet_id: hotWalletInfo.walletId,
                hot_wallet_address: hotWalletInfo.address,
                destination_address,
                amount: parsedAmount,
                amount_usdc: usdcAmount,
                transaction_id: transactionId,
                transaction_hash: transactionHash,
                previous_balance: hotWalletBalance,
                new_balance: hotWalletBalance - parsedAmount,
            }),
        ]);
        return (0, errors_1.sendSuccess)(res, {
            message: "Funds withdrawn to cold storage successfully",
            transaction_id: transactionId,
            transaction_hash: transactionHash,
            amount: parsedAmount,
            amount_usdc: usdcAmount,
            destination_address,
            hot_wallet_balance_before: hotWalletBalance,
            hot_wallet_balance_after: hotWalletBalance - parsedAmount,
        });
    }
    catch (error) {
        console.error("Withdraw to cold storage error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.withdrawToColdStorage = withdrawToColdStorage;
/**
 * @route GET /api/admin/settings
 * @desc Get all admin control settings
 * @access Admin
 */
const getAdminSettings = async (req, res) => {
    try {
        const config = await Moodring_1.MoodringModel.get();
        if (!config) {
            return (0, errors_1.sendNotFound)(res, "Moodring config");
        }
        // Organize settings into logical groups
        const settings = {
            admin_controls: {
                maintenance_mode: config.maintenance_mode,
                allow_user_registration: config.allow_user_registration,
                allow_market_creation: config.allow_market_creation,
                allow_trading: config.allow_trading,
                allow_withdrawals: config.allow_withdrawals,
                allow_deposits: config.allow_deposits,
            },
            trading_limits: {
                min_trade_amount: Number(config.min_trade_amount),
                max_trade_amount: Number(config.max_trade_amount),
                max_position_per_market: Number(config.max_position_per_market),
                max_daily_user_volume: Number(config.max_daily_user_volume),
            },
            market_controls: {
                max_markets_per_user: config.max_markets_per_user,
                max_open_markets_per_user: config.max_open_markets_per_user,
                min_market_duration_hours: config.min_market_duration_hours,
                max_market_duration_days: config.max_market_duration_days,
                max_market_options: config.max_market_options,
            },
            resolution_controls: {
                auto_resolve_markets: config.auto_resolve_markets,
                resolution_oracle_enabled: config.resolution_oracle_enabled,
                authority_resolution_enabled: config.authority_resolution_enabled,
                opinion_resolution_enabled: config.opinion_resolution_enabled,
            },
            liquidity_controls: {
                min_initial_liquidity: Number(config.min_initial_liquidity),
            },
            risk_controls: {
                max_market_volatility_threshold: config.max_market_volatility_threshold,
                suspicious_trade_threshold: Number(config.suspicious_trade_threshold),
                circuit_breaker_threshold: Number(config.circuit_breaker_threshold),
            },
            dispute_controls: {
                default_dispute_period_hours: config.default_dispute_period_hours,
                required_dispute_bond: Number(config.required_dispute_bond),
            },
            feature_flags: {
                enable_copy_trading: config.enable_copy_trading,
                enable_social_feed: config.enable_social_feed,
                enable_live_rooms: config.enable_live_rooms,
                enable_referrals: config.enable_referrals,
                enable_notifications: config.enable_notifications,
            },
            platform_fees: {
                lp_fee_rate: config.lp_fee_rate,
                protocol_fee_rate: config.protocol_fee_rate,
                creator_fee_rate: config.creator_fee_rate,
            },
        };
        return (0, errors_1.sendSuccess)(res, { settings });
    }
    catch (error) {
        console.error("Get admin settings error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getAdminSettings = getAdminSettings;
/**
 * @route PUT /api/admin/settings
 * @desc Update admin control settings
 * @access Admin
 */
const updateAdminSettings = async (req, res) => {
    try {
        const { admin_controls, trading_limits, market_controls, resolution_controls, liquidity_controls, risk_controls, dispute_controls, feature_flags, platform_fees, } = req.body;
        // Build update object by flattening the nested structure
        const updateData = {};
        if (admin_controls) {
            Object.assign(updateData, admin_controls);
        }
        if (trading_limits) {
            Object.assign(updateData, trading_limits);
        }
        if (market_controls) {
            Object.assign(updateData, market_controls);
        }
        if (resolution_controls) {
            Object.assign(updateData, resolution_controls);
        }
        if (liquidity_controls) {
            Object.assign(updateData, liquidity_controls);
        }
        if (risk_controls) {
            Object.assign(updateData, risk_controls);
        }
        if (dispute_controls) {
            Object.assign(updateData, dispute_controls);
        }
        if (feature_flags) {
            Object.assign(updateData, feature_flags);
        }
        if (platform_fees) {
            Object.assign(updateData, platform_fees);
        }
        // Validate that at least one field is being updated
        if (Object.keys(updateData).length === 0) {
            return (0, errors_1.sendValidationError)(res, "At least one setting must be provided");
        }
        // Update the settings
        const updatedConfig = await Moodring_1.MoodringModel.update(updateData);
        if (!updatedConfig) {
            return (0, errors_1.sendNotFound)(res, "Moodring config");
        }
        // Log the admin action
        await db_1.pool.query(`INSERT INTO admin_actions (admin_user_id, action_type, metadata)
       VALUES ($1, 'settings_update', $2)`, [
            req.id,
            (0, json_1.prepareJsonb)({
                updated_fields: Object.keys(updateData),
                old_values: {}, // Would need to be populated from before update
                new_values: updateData,
            }),
        ]);
        return (0, errors_1.sendSuccess)(res, {
            message: "Admin settings updated successfully",
            updated_fields: Object.keys(updateData),
        });
    }
    catch (error) {
        console.error("Update admin settings error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.updateAdminSettings = updateAdminSettings;
/**
 * @route GET /api/admin/settings/:group
 * @desc Get specific group of admin settings
 * @access Admin
 */
const getAdminSettingsGroup = async (req, res) => {
    try {
        const { group } = req.params;
        const validGroups = [
            "admin_controls",
            "trading_limits",
            "market_controls",
            "resolution_controls",
            "liquidity_controls",
            "risk_controls",
            "dispute_controls",
            "feature_flags",
            "platform_fees",
        ];
        if (!validGroups.includes(group)) {
            return (0, errors_1.sendValidationError)(res, `Invalid settings group. Valid groups: ${validGroups.join(", ")}`);
        }
        const config = await Moodring_1.MoodringModel.get();
        if (!config) {
            return (0, errors_1.sendNotFound)(res, "Moodring config");
        }
        // Get the specific group data
        let groupData = {};
        switch (group) {
            case "admin_controls":
                groupData = {
                    maintenance_mode: config.maintenance_mode,
                    allow_user_registration: config.allow_user_registration,
                    allow_market_creation: config.allow_market_creation,
                    allow_trading: config.allow_trading,
                    allow_withdrawals: config.allow_withdrawals,
                    allow_deposits: config.allow_deposits,
                };
                break;
            case "trading_limits":
                groupData = {
                    min_trade_amount: Number(config.min_trade_amount),
                    max_trade_amount: Number(config.max_trade_amount),
                    max_position_per_market: Number(config.max_position_per_market),
                    max_daily_user_volume: Number(config.max_daily_user_volume),
                };
                break;
            case "market_controls":
                groupData = {
                    max_markets_per_user: config.max_markets_per_user,
                    max_open_markets_per_user: config.max_open_markets_per_user,
                    min_market_duration_hours: config.min_market_duration_hours,
                    max_market_duration_days: config.max_market_duration_days,
                    max_market_options: config.max_market_options,
                };
                break;
            case "resolution_controls":
                groupData = {
                    auto_resolve_markets: config.auto_resolve_markets,
                    resolution_oracle_enabled: config.resolution_oracle_enabled,
                    authority_resolution_enabled: config.authority_resolution_enabled,
                    opinion_resolution_enabled: config.opinion_resolution_enabled,
                };
                break;
            case "liquidity_controls":
                groupData = {
                    min_initial_liquidity: Number(config.min_initial_liquidity),
                };
                break;
            case "risk_controls":
                groupData = {
                    max_market_volatility_threshold: config.max_market_volatility_threshold,
                    suspicious_trade_threshold: Number(config.suspicious_trade_threshold),
                    circuit_breaker_threshold: Number(config.circuit_breaker_threshold),
                };
                break;
            case "dispute_controls":
                groupData = {
                    default_dispute_period_hours: config.default_dispute_period_hours,
                    required_dispute_bond: Number(config.required_dispute_bond),
                };
                break;
            case "feature_flags":
                groupData = {
                    enable_copy_trading: config.enable_copy_trading,
                    enable_social_feed: config.enable_social_feed,
                    enable_live_rooms: config.enable_live_rooms,
                    enable_referrals: config.enable_referrals,
                    enable_notifications: config.enable_notifications,
                };
                break;
            case "platform_fees":
                groupData = {
                    lp_fee_rate: config.lp_fee_rate,
                    protocol_fee_rate: config.protocol_fee_rate,
                    creator_fee_rate: config.creator_fee_rate,
                };
                break;
        }
        return (0, errors_1.sendSuccess)(res, { [group]: groupData });
    }
    catch (error) {
        console.error("Get admin settings group error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getAdminSettingsGroup = getAdminSettingsGroup;
/**
 * @route GET /api/admin/suspicious-trades
 * @desc Get pending suspicious trades for review
 * @access Admin
 */
const getSuspiciousTrades = async (req, // Reuse request type
res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.page) || 0;
        const { suspiciousTrades, total } = await SuspiciousTrade_1.SuspiciousTradeModel.findPending(limit, offset);
        return (0, errors_1.sendSuccess)(res, {
            suspicious_trades: suspiciousTrades,
            pagination: {
                total,
                limit,
                offset,
                has_more: offset + limit < total,
            },
        });
    }
    catch (error) {
        console.error("Get suspicious trades error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getSuspiciousTrades = getSuspiciousTrades;
/**
 * @route GET /api/admin/suspicious-trades/stats
 * @desc Get suspicious trade statistics
 * @access Admin
 */
const getSuspiciousTradesStats = async (req, res) => {
    try {
        const stats = await SuspiciousTrade_1.SuspiciousTradeModel.getStats();
        return (0, errors_1.sendSuccess)(res, {
            stats,
        });
    }
    catch (error) {
        console.error("Get suspicious trades stats error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getSuspiciousTradesStats = getSuspiciousTradesStats;
/**
 * @route POST /api/admin/suspicious-trades/:id/review
 * @desc Review and update suspicious trade status
 * @access Admin
 */
const reviewSuspiciousTrade = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.id;
        const { review_status, review_notes, risk_score, manual_action_required } = req.body;
        // Validate required fields
        const validation = (0, validation_1.validateFields)([
            (0, validation_1.validateRequired)(review_status, "Review status"),
            (0, validation_1.validateEnum)(review_status, "Review status", [
                "pending",
                "reviewed",
                "cleared",
                "flagged",
            ]),
        ]);
        if (!validation.isValid) {
            return (0, errors_1.sendValidationError)(res, validation.error);
        }
        const updatedTrade = await SuspiciousTrade_1.SuspiciousTradeModel.updateReviewStatus(id, {
            review_status,
            reviewed_by: adminId,
            reviewed_at: Math.floor(Date.now() / 1000),
            review_notes,
            risk_score,
            manual_action_required,
        });
        if (!updatedTrade) {
            return (0, errors_1.sendNotFound)(res, "Suspicious trade not found");
        }
        return (0, errors_1.sendSuccess)(res, {
            suspicious_trade: updatedTrade,
            message: "Suspicious trade reviewed successfully",
        });
    }
    catch (error) {
        console.error("Review suspicious trade error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.reviewSuspiciousTrade = reviewSuspiciousTrade;
/**
 * @route GET /api/admin/suspicious-trades/user/:userId
 * @desc Get suspicious trades for a specific user
 * @access Admin
 */
const getUserSuspiciousTrades = async (req, res) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const { suspiciousTrades, total } = await SuspiciousTrade_1.SuspiciousTradeModel.findByUserId(userId, limit, offset);
        return (0, errors_1.sendSuccess)(res, {
            suspicious_trades: suspiciousTrades,
            pagination: {
                total,
                limit,
                offset,
                has_more: offset + limit < total,
            },
        });
    }
    catch (error) {
        console.error("Get user suspicious trades error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getUserSuspiciousTrades = getUserSuspiciousTrades;
/**
 * @route POST /api/admin/user/:id/admin
 * @desc Add or remove admin privileges for a user
 * @access Admin
 */
const toggleUserAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_admin } = req.body;
        if (typeof is_admin !== "boolean") {
            return (0, errors_1.sendValidationError)(res, "is_admin must be a boolean");
        }
        const { MoodringAdminModel } = require("../models/Moodring");
        if (is_admin) {
            // Add admin
            const admin = await MoodringAdminModel.addAdmin(id);
            return (0, errors_1.sendSuccess)(res, {
                message: "User granted admin privileges",
                is_admin: true,
            });
        }
        else {
            // Remove admin
            const removed = await MoodringAdminModel.removeAdmin(id);
            if (!removed) {
                return (0, errors_1.sendError)(res, 404, "Admin record not found");
            }
            return (0, errors_1.sendSuccess)(res, {
                message: "Admin privileges removed",
                is_admin: false,
            });
        }
    }
    catch (error) {
        console.error("Toggle user admin error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.toggleUserAdmin = toggleUserAdmin;
/**
 * @route GET /api/admin/disputes
 * @desc Get all disputes with optional filtering
 * @access Admin
 */
const getDisputes = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const options = {
            limit,
            offset,
        };
        if (req.query.status) {
            options.status = req.query.status;
        }
        if (req.query.market_id) {
            options.market_id = req.query.market_id;
        }
        const { disputes, total } = await Dispute_1.DisputeModel.findAll(options);
        return (0, errors_1.sendSuccess)(res, {
            disputes,
            pagination: {
                total,
                page,
                limit,
                offset,
                has_more: offset + limit < total,
            },
        });
    }
    catch (error) {
        console.error("Get disputes error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getDisputes = getDisputes;
/**
 * @route GET /api/admin/disputes/:id
 * @desc Get a specific dispute by ID
 * @access Admin
 */
const getDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const dispute = await Dispute_1.DisputeModel.findById(id);
        if (!dispute) {
            return (0, errors_1.sendNotFound)(res, "Dispute");
        }
        return (0, errors_1.sendSuccess)(res, { dispute });
    }
    catch (error) {
        console.error("Get dispute error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.getDispute = getDispute;
/**
 * @route POST /api/admin/disputes/:id/resolve
 * @desc Resolve or dismiss a dispute
 * @access Admin
 */
const resolveDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.id;
        const { status, review_notes } = req.body;
        // Validate required fields
        const validation = (0, validation_1.validateFields)([
            (0, validation_1.validateRequired)(status, "Status"),
            (0, validation_1.validateEnum)(status, "Status", ["resolved", "dismissed"]),
        ]);
        if (!validation.isValid) {
            return (0, errors_1.sendValidationError)(res, validation.error);
        }
        // Check if dispute exists
        const dispute = await Dispute_1.DisputeModel.findById(id);
        if (!dispute) {
            return (0, errors_1.sendNotFound)(res, "Dispute");
        }
        // Update dispute status
        const updatedDispute = await Dispute_1.DisputeModel.update(id, {
            status,
            reviewed_by: adminId,
            reviewed_at: Math.floor(Date.now() / 1000),
            review_notes: review_notes || null,
        });
        return (0, errors_1.sendSuccess)(res, {
            dispute: updatedDispute,
            message: `Dispute ${status === "resolved" ? "resolved" : "dismissed"} successfully`,
        });
    }
    catch (error) {
        console.error("Resolve dispute error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Internal server error");
    }
};
exports.resolveDispute = resolveDispute;
//# sourceMappingURL=controller_admin.js.map