"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKeyHolders = exports.setRequiredKeys = exports.getKeyOwnership = exports.getKeyPrice = exports.sellKeys = exports.buyKeys = void 0;
const db_1 = require("../db");
const Wallet_1 = require("../models/Wallet");
const User_1 = require("../models/User");
const UserKey_1 = require("../models/UserKey");
const bondingCurve_1 = require("../utils/bondingCurve");
const errors_1 = require("../utils/errors");
const transaction_1 = require("../utils/transaction");
const websocket_1 = require("../services/websocket");
/**
 * @route POST /api/key/buy
 * @desc Buy keys for a trader using bonding curve pricing
 * @access Private
 */
const buyKeys = async (req, res) => {
    try {
        const buyerId = req.id;
        if (!buyerId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { trader_id, quantity } = req.body;
        // Validate inputs
        if (!trader_id) {
            return (0, errors_1.sendValidationError)(res, "Trader ID is required");
        }
        if (!quantity || quantity <= 0) {
            return (0, errors_1.sendValidationError)(res, "Quantity must be a positive number");
        }
        // Validate quantity has at most 6 decimals
        const quantityStr = quantity.toString();
        const decimalParts = quantityStr.split(".");
        if (decimalParts.length > 1 && decimalParts[1].length > 6) {
            return (0, errors_1.sendValidationError)(res, "Quantity can have at most 6 decimal places");
        }
        // Can't buy your own keys
        if (buyerId === trader_id) {
            return (0, errors_1.sendError)(res, 400, "You cannot buy your own keys");
        }
        const result = await (0, transaction_1.withTransaction)(async (client) => {
            // Get trader info with lock
            const traderResult = await client.query(`SELECT id, keys_supply FROM users WHERE id = $1 FOR UPDATE`, [trader_id]);
            if (traderResult.rows.length === 0) {
                throw new transaction_1.TransactionError(404, "Trader not found");
            }
            const trader = traderResult.rows[0];
            const currentSupply = Number(trader.keys_supply) || 1; // Default to 1 (founder key)
            // Calculate cost using bonding curve
            const totalCost = (0, bondingCurve_1.getBuyCostMicroUsdc)(currentSupply, quantity);
            const averagePrice = (0, bondingCurve_1.getAverageBuyPrice)(currentSupply, quantity);
            // Get buyer's wallet with lock
            const buyerWallet = await Wallet_1.WalletModel.findByUserId(buyerId, client);
            if (!buyerWallet) {
                throw new transaction_1.TransactionError(404, "Buyer wallet not found");
            }
            // Lock wallet
            const walletResult = await client.query(`SELECT * FROM wallets WHERE id = $1 FOR UPDATE`, [buyerWallet.id]);
            const wallet = walletResult.rows[0];
            // Check balance
            if (Number(wallet.balance_usdc) < totalCost) {
                throw new transaction_1.TransactionError(400, "Insufficient balance", {
                    required: totalCost,
                    available: Number(wallet.balance_usdc),
                });
            }
            // Deduct from buyer's wallet
            const newBuyerBalance = Number(wallet.balance_usdc) - totalCost;
            await client.query(`UPDATE wallets SET balance_usdc = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`, [newBuyerBalance, wallet.id]);
            // Get trader's wallet and add proceeds
            const traderWallet = await Wallet_1.WalletModel.findByUserId(trader_id, client);
            if (traderWallet) {
                const newTraderBalance = Number(traderWallet.balance_usdc) + totalCost;
                await client.query(`UPDATE wallets SET balance_usdc = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`, [newTraderBalance, traderWallet.id]);
            }
            // Update key supply
            const newSupply = currentSupply + quantity;
            await client.query(`UPDATE users SET keys_supply = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`, [newSupply, trader_id]);
            // Update or create key ownership record
            const keyRecord = await UserKey_1.UserKeyModel.getOrCreate(trader_id, buyerId, client);
            const newQuantity = Number(keyRecord.quantity || 0) + Number(quantity);
            await UserKey_1.UserKeyModel.updateQuantity(trader_id, buyerId, newQuantity, client);
            // Record transaction
            await UserKey_1.KeyTransactionModel.create({
                trader_id: trader_id,
                buyer_id: buyerId,
                transaction_type: "buy",
                quantity,
                price_per_key: Math.floor(averagePrice * 1000000),
                total_cost: totalCost,
                supply_before: currentSupply,
                supply_after: newSupply,
            }, client);
            return {
                quantity,
                total_cost: totalCost,
                average_price: averagePrice,
                new_supply: newSupply,
                new_balance: newBuyerBalance,
            };
        });
        // Emit balance update via websocket
        try {
            (0, websocket_1.emitBalanceUpdate)({
                user_id: buyerId,
                balance_usdc: result.new_balance,
                timestamp: new Date(),
            });
        }
        catch (wsError) {
            console.error("WebSocket emission error:", wsError);
        }
        return (0, errors_1.sendSuccess)(res, {
            message: "Keys purchased successfully",
            ...result,
        });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Buy keys error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to buy keys. Please try again.");
    }
};
exports.buyKeys = buyKeys;
/**
 * @route POST /api/key/sell
 * @desc Sell keys for a trader using bonding curve pricing
 * @access Private
 */
const sellKeys = async (req, res) => {
    try {
        const sellerId = req.id;
        if (!sellerId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { trader_id, quantity } = req.body;
        // Validate inputs
        if (!trader_id) {
            return (0, errors_1.sendValidationError)(res, "Trader ID is required");
        }
        if (!quantity || quantity <= 0) {
            return (0, errors_1.sendValidationError)(res, "Quantity must be a positive number");
        }
        // Validate quantity has at most 6 decimals
        const quantityStr = quantity.toString();
        const decimalParts = quantityStr.split(".");
        if (decimalParts.length > 1 && decimalParts[1].length > 6) {
            return (0, errors_1.sendValidationError)(res, "Quantity can have at most 6 decimal places");
        }
        const result = await (0, transaction_1.withTransaction)(async (client) => {
            // Get trader info with lock
            const traderResult = await client.query(`SELECT id, keys_supply FROM users WHERE id = $1 FOR UPDATE`, [trader_id]);
            if (traderResult.rows.length === 0) {
                throw new transaction_1.TransactionError(404, "Trader not found");
            }
            const trader = traderResult.rows[0];
            const currentSupply = Number(trader.keys_supply) || 1; // Default to 1 (founder key)
            if (currentSupply < quantity) {
                throw new transaction_1.TransactionError(400, "Insufficient supply", {
                    requested: quantity,
                    available: currentSupply,
                });
            }
            // Check if seller is the trader themselves
            const isTrader = sellerId === trader_id;
            // Check seller's key ownership
            const sellerKeys = await UserKey_1.UserKeyModel.getQuantity(trader_id, sellerId, client);
            if (sellerKeys < quantity) {
                throw new transaction_1.TransactionError(400, "Insufficient keys", {
                    requested: quantity,
                    owned: sellerKeys,
                });
            }
            // If trader is selling their own keys, ensure they keep at least 1 key (the unsellable founder key)
            if (isTrader) {
                const newSupply = Number(currentSupply) - Number(quantity);
                if (newSupply < 1) {
                    throw new transaction_1.TransactionError(400, "You must keep at least 1 key (the unsellable founder key)", {
                        current_supply: currentSupply,
                        requested: quantity,
                        minimum_supply: 1,
                        max_sellable: currentSupply - 1,
                    });
                }
            }
            // Calculate payout using bonding curve
            const totalPayout = (0, bondingCurve_1.getSellPayoutMicroUsdc)(currentSupply, quantity);
            const averagePrice = (0, bondingCurve_1.getAverageSellPrice)(currentSupply, quantity);
            // Get seller's wallet with lock
            const sellerWallet = await Wallet_1.WalletModel.findByUserId(sellerId, client);
            if (!sellerWallet) {
                throw new transaction_1.TransactionError(404, "Seller wallet not found");
            }
            // Lock wallet
            const walletResult = await client.query(`SELECT * FROM wallets WHERE id = $1 FOR UPDATE`, [sellerWallet.id]);
            const wallet = walletResult.rows[0];
            // Add to seller's wallet
            const newSellerBalance = Number(wallet.balance_usdc) + totalPayout;
            await client.query(`UPDATE wallets SET balance_usdc = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`, [newSellerBalance, wallet.id]);
            // Get trader's wallet and deduct proceeds
            const traderWallet = await Wallet_1.WalletModel.findByUserId(trader_id, client);
            if (traderWallet) {
                const newTraderBalance = Number(traderWallet.balance_usdc) - totalPayout;
                // Ensure trader's balance doesn't go negative (shouldn't happen, but safety check)
                if (newTraderBalance < 0) {
                    throw new transaction_1.TransactionError(500, "Trader wallet balance would be negative");
                }
                await client.query(`UPDATE wallets SET balance_usdc = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`, [newTraderBalance, traderWallet.id]);
            }
            // Update key supply
            const newSupply = currentSupply - quantity;
            await client.query(`UPDATE users SET keys_supply = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`, [newSupply, trader_id]);
            // Update key ownership record
            const newQuantity = Number(sellerKeys) - Number(quantity);
            if (newQuantity > 0.000001) {
                // Use small epsilon for decimal comparison
                await UserKey_1.UserKeyModel.updateQuantity(trader_id, sellerId, newQuantity, client);
            }
            else {
                // Delete record if quantity reaches 0
                await UserKey_1.UserKeyModel.delete(trader_id, sellerId, client);
            }
            // Record transaction
            await UserKey_1.KeyTransactionModel.create({
                trader_id: trader_id,
                buyer_id: sellerId,
                transaction_type: "sell",
                quantity,
                price_per_key: Math.floor(averagePrice * 1000000),
                total_cost: totalPayout,
                supply_before: currentSupply,
                supply_after: newSupply,
            }, client);
            return {
                quantity,
                total_payout: totalPayout,
                average_price: averagePrice,
                new_supply: newSupply,
                new_balance: newSellerBalance,
            };
        });
        // Emit balance update via websocket
        try {
            (0, websocket_1.emitBalanceUpdate)({
                user_id: sellerId,
                balance_usdc: result.new_balance,
                timestamp: new Date(),
            });
        }
        catch (wsError) {
            console.error("WebSocket emission error:", wsError);
        }
        return (0, errors_1.sendSuccess)(res, {
            message: "Keys sold successfully",
            ...result,
        });
    }
    catch (error) {
        if (error instanceof transaction_1.TransactionError) {
            return (0, errors_1.sendError)(res, error.statusCode, error.message, error.details);
        }
        console.error("Sell keys error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to sell keys. Please try again.");
    }
};
exports.sellKeys = sellKeys;
/**
 * @route GET /api/key/price/:trader_id
 * @desc Get current key price for a trader
 * @access Public
 */
const getKeyPrice = async (req, res) => {
    try {
        const { trader_id } = req.params;
        const trader = await User_1.UserModel.findById(trader_id);
        if (!trader) {
            return (0, errors_1.sendNotFound)(res, "Trader");
        }
        const supply = Number(trader.keys_supply) || 1; // Default to 1 (founder key)
        const currentPrice = (0, bondingCurve_1.getKeyPriceMicroUsdc)(supply);
        const nextPrice = (0, bondingCurve_1.getKeyPriceMicroUsdc)(supply + 1);
        return (0, errors_1.sendSuccess)(res, {
            trader_id,
            supply,
            current_price: currentPrice,
            next_price: nextPrice,
            price_in_usdc: currentPrice / 1000000,
            next_price_in_usdc: nextPrice / 1000000,
        });
    }
    catch (error) {
        console.error("Get key price error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to get key price. Please try again.");
    }
};
exports.getKeyPrice = getKeyPrice;
/**
 * @route GET /api/key/ownership/:trader_id
 * @desc Get current user's key ownership for a trader
 * @access Private
 */
const getKeyOwnership = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { trader_id } = req.params;
        const quantity = await UserKey_1.UserKeyModel.getQuantity(trader_id, userId);
        return (0, errors_1.sendSuccess)(res, {
            trader_id,
            quantity,
            has_keys: quantity > 0,
        });
    }
    catch (error) {
        console.error("Get key ownership error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to get key ownership. Please try again.");
    }
};
exports.getKeyOwnership = getKeyOwnership;
/**
 * @route POST /api/key/set-required
 * @desc Set the required number of keys to follow trades
 * @access Private
 */
const setRequiredKeys = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return (0, errors_1.sendError)(res, 401, "Unauthorized");
        }
        const { required_keys } = req.body;
        if (required_keys === undefined || required_keys < 0) {
            return (0, errors_1.sendValidationError)(res, "Required keys must be a non-negative number");
        }
        // Validate required_keys has at most 6 decimals
        const requiredKeysStr = required_keys.toString();
        const decimalParts = requiredKeysStr.split(".");
        if (decimalParts.length > 1 && decimalParts[1].length > 6) {
            return (0, errors_1.sendValidationError)(res, "Required keys can have at most 6 decimal places");
        }
        await db_1.pool.query(`UPDATE users SET required_keys_to_follow = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`, [required_keys, userId]);
        return (0, errors_1.sendSuccess)(res, {
            message: "Required keys updated successfully",
            required_keys,
        });
    }
    catch (error) {
        console.error("Set required keys error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to set required keys. Please try again.");
    }
};
exports.setRequiredKeys = setRequiredKeys;
/**
 * @route GET /api/key/holders/:trader_id
 * @desc Get list of key holders for a trader
 * @access Public
 */
const getKeyHolders = async (req, res) => {
    try {
        const { trader_id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;
        const holders = await UserKey_1.UserKeyModel.getHoldersByTrader(trader_id);
        const total = holders.length;
        const paginatedHolders = holders.slice(offset, offset + limit);
        const totalPages = Math.ceil(total / limit);
        // Get user info for each holder
        const holdersWithInfo = await Promise.all(paginatedHolders.map(async (key) => {
            const user = await User_1.UserModel.findById(key.holder_id);
            return {
                holder_id: key.holder_id,
                quantity: key.quantity,
                username: user?.username,
                display_name: user?.display_name,
                avatar_url: user?.avatar_url,
            };
        }));
        return (0, errors_1.sendSuccess)(res, {
            holders: holdersWithInfo,
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
        console.error("Get key holders error:", error);
        return (0, errors_1.sendError)(res, 500, error.message || "Failed to get key holders. Please try again.");
    }
};
exports.getKeyHolders = getKeyHolders;
//# sourceMappingURL=controller_key.js.map