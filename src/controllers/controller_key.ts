import { Response } from "express";
import { UUID } from "crypto";
import { pool } from "../db";
import { WalletModel } from "../models/Wallet";
import { UserModel } from "../models/User";
import { UserKeyModel, KeyTransactionModel } from "../models/UserKey";
import {
  getBuyCostMicroUsdc,
  getSellPayoutMicroUsdc,
  getKeyPriceMicroUsdc,
  getAverageBuyPrice,
  getAverageSellPrice,
} from "../utils/bondingCurve";
import {
  sendError,
  sendNotFound,
  sendSuccess,
  sendValidationError,
} from "../utils/errors";
import { withTransaction, TransactionError } from "../utils/transaction";
import {
  BuyKeysRequest,
  SellKeysRequest,
  GetKeyPriceRequest,
  GetKeyOwnershipRequest,
  SetRequiredKeysRequest,
  GetKeyHoldersRequest,
} from "../types/requests";
import { emitBalanceUpdate } from "../services/websocket";

/**
 * @route POST /api/key/buy
 * @desc Buy keys for a trader using bonding curve pricing
 * @access Private
 */
export const buyKeys = async (req: BuyKeysRequest, res: Response) => {
  try {
    const buyerId = req.id;
    if (!buyerId) {
      return sendError(res, 401, "Unauthorized");
    }

    const { trader_id, quantity } = req.body;

    // Validate inputs
    if (!trader_id) {
      return sendValidationError(res, "Trader ID is required");
    }

    if (!quantity || quantity <= 0) {
      return sendValidationError(res, "Quantity must be a positive number");
    }

    // Validate quantity has at most 6 decimals
    const quantityStr = quantity.toString();
    const decimalParts = quantityStr.split(".");
    if (decimalParts.length > 1 && decimalParts[1].length > 6) {
      return sendValidationError(
        res,
        "Quantity can have at most 6 decimal places"
      );
    }

    // Can't buy your own keys
    if (buyerId === trader_id) {
      return sendError(res, 400, "You cannot buy your own keys");
    }

    const result = await withTransaction(async (client) => {
      // Get trader info with lock
      const traderResult = await client.query(
        `SELECT id, keys_supply FROM users WHERE id = $1 FOR UPDATE`,
        [trader_id]
      );

      if (traderResult.rows.length === 0) {
        throw new TransactionError(404, "Trader not found");
      }

      const trader = traderResult.rows[0];
      const currentSupply = Number(trader.keys_supply) || 1; // Default to 1 (founder key)

      // Calculate cost using bonding curve
      const totalCost = getBuyCostMicroUsdc(currentSupply, quantity);
      const averagePrice = getAverageBuyPrice(currentSupply, quantity);

      // Get buyer's wallet with lock
      const buyerWallet = await WalletModel.findByUserId(buyerId, client);
      if (!buyerWallet) {
        throw new TransactionError(404, "Buyer wallet not found");
      }

      // Lock wallet
      const walletResult = await client.query(
        `SELECT * FROM wallets WHERE id = $1 FOR UPDATE`,
        [buyerWallet.id]
      );
      const wallet = walletResult.rows[0];

      // Check balance
      if (Number(wallet.balance_usdc) < totalCost) {
        throw new TransactionError(400, "Insufficient balance", {
          required: totalCost,
          available: Number(wallet.balance_usdc),
        });
      }

      // Deduct from buyer's wallet
      const newBuyerBalance = Number(wallet.balance_usdc) - totalCost;
      await client.query(
        `UPDATE wallets SET balance_usdc = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`,
        [newBuyerBalance, wallet.id]
      );

      // Get trader's wallet and add proceeds
      const traderWallet = await WalletModel.findByUserId(trader_id, client);
      if (traderWallet) {
        const newTraderBalance = Number(traderWallet.balance_usdc) + totalCost;
        await client.query(
          `UPDATE wallets SET balance_usdc = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`,
          [newTraderBalance, traderWallet.id]
        );
      }

      // Update key supply
      const newSupply = currentSupply + quantity;
      await client.query(
        `UPDATE users SET keys_supply = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`,
        [newSupply, trader_id]
      );

      // Update or create key ownership record
      const keyRecord = await UserKeyModel.getOrCreate(
        trader_id,
        buyerId,
        client
      );
      const newQuantity = Number(keyRecord.quantity || 0) + Number(quantity);
      await UserKeyModel.updateQuantity(
        trader_id,
        buyerId,
        newQuantity,
        client
      );

      // Record transaction
      await KeyTransactionModel.create(
        {
          trader_id: trader_id as UUID,
          buyer_id: buyerId as UUID,
          transaction_type: "buy",
          quantity,
          price_per_key: Math.floor(averagePrice * 1_000_000),
          total_cost: totalCost,
          supply_before: currentSupply,
          supply_after: newSupply,
        },
        client
      );

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
      emitBalanceUpdate({
        user_id: buyerId,
        balance_usdc: result.new_balance,
        timestamp: new Date(),
      });
    } catch (wsError) {
      console.error("WebSocket emission error:", wsError);
    }

    return sendSuccess(res, {
      message: "Keys purchased successfully",
      ...result,
    });
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return sendError(res, error.statusCode, error.message, error.details);
    }
    console.error("Buy keys error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to buy keys. Please try again."
    );
  }
};

/**
 * @route POST /api/key/sell
 * @desc Sell keys for a trader using bonding curve pricing
 * @access Private
 */
export const sellKeys = async (req: SellKeysRequest, res: Response) => {
  try {
    const sellerId = req.id;
    if (!sellerId) {
      return sendError(res, 401, "Unauthorized");
    }

    const { trader_id, quantity } = req.body;

    // Validate inputs
    if (!trader_id) {
      return sendValidationError(res, "Trader ID is required");
    }

    if (!quantity || quantity <= 0) {
      return sendValidationError(res, "Quantity must be a positive number");
    }

    // Validate quantity has at most 6 decimals
    const quantityStr = quantity.toString();
    const decimalParts = quantityStr.split(".");
    if (decimalParts.length > 1 && decimalParts[1].length > 6) {
      return sendValidationError(
        res,
        "Quantity can have at most 6 decimal places"
      );
    }

    const result = await withTransaction(async (client) => {
      // Get trader info with lock
      const traderResult = await client.query(
        `SELECT id, keys_supply FROM users WHERE id = $1 FOR UPDATE`,
        [trader_id]
      );

      if (traderResult.rows.length === 0) {
        throw new TransactionError(404, "Trader not found");
      }

      const trader = traderResult.rows[0];
      const currentSupply = Number(trader.keys_supply) || 1; // Default to 1 (founder key)

      if (currentSupply < quantity) {
        throw new TransactionError(400, "Insufficient supply", {
          requested: quantity,
          available: currentSupply,
        });
      }

      // Check if seller is the trader themselves
      const isTrader = sellerId === trader_id;

      // Check seller's key ownership
      const sellerKeys = await UserKeyModel.getQuantity(
        trader_id,
        sellerId,
        client
      );

      if (sellerKeys < quantity) {
        throw new TransactionError(400, "Insufficient keys", {
          requested: quantity,
          owned: sellerKeys,
        });
      }

      // If trader is selling their own keys, ensure they keep at least 1 key (the unsellable founder key)
      if (isTrader) {
        const newSupply = Number(currentSupply) - Number(quantity);
        if (newSupply < 1) {
          throw new TransactionError(
            400,
            "You must keep at least 1 key (the unsellable founder key)",
            {
              current_supply: currentSupply,
              requested: quantity,
              minimum_supply: 1,
              max_sellable: currentSupply - 1,
            }
          );
        }
      }

      // Calculate payout using bonding curve
      const totalPayout = getSellPayoutMicroUsdc(currentSupply, quantity);
      const averagePrice = getAverageSellPrice(currentSupply, quantity);

      // Get seller's wallet with lock
      const sellerWallet = await WalletModel.findByUserId(sellerId, client);
      if (!sellerWallet) {
        throw new TransactionError(404, "Seller wallet not found");
      }

      // Lock wallet
      const walletResult = await client.query(
        `SELECT * FROM wallets WHERE id = $1 FOR UPDATE`,
        [sellerWallet.id]
      );
      const wallet = walletResult.rows[0];

      // Add to seller's wallet
      const newSellerBalance = Number(wallet.balance_usdc) + totalPayout;
      await client.query(
        `UPDATE wallets SET balance_usdc = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`,
        [newSellerBalance, wallet.id]
      );

      // Get trader's wallet and deduct proceeds
      const traderWallet = await WalletModel.findByUserId(trader_id, client);
      if (traderWallet) {
        const newTraderBalance =
          Number(traderWallet.balance_usdc) - totalPayout;
        // Ensure trader's balance doesn't go negative (shouldn't happen, but safety check)
        if (newTraderBalance < 0) {
          throw new TransactionError(
            500,
            "Trader wallet balance would be negative"
          );
        }
        await client.query(
          `UPDATE wallets SET balance_usdc = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`,
          [newTraderBalance, traderWallet.id]
        );
      }

      // Update key supply
      const newSupply = currentSupply - quantity;
      await client.query(
        `UPDATE users SET keys_supply = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`,
        [newSupply, trader_id]
      );

      // Update key ownership record
      const newQuantity = Number(sellerKeys) - Number(quantity);
      if (newQuantity > 0.000001) {
        // Use small epsilon for decimal comparison
        await UserKeyModel.updateQuantity(
          trader_id,
          sellerId,
          newQuantity,
          client
        );
      } else {
        // Delete record if quantity reaches 0
        await UserKeyModel.delete(trader_id, sellerId, client);
      }

      // Record transaction
      await KeyTransactionModel.create(
        {
          trader_id: trader_id as UUID,
          buyer_id: sellerId as UUID,
          transaction_type: "sell",
          quantity,
          price_per_key: Math.floor(averagePrice * 1_000_000),
          total_cost: totalPayout,
          supply_before: currentSupply,
          supply_after: newSupply,
        },
        client
      );

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
      emitBalanceUpdate({
        user_id: sellerId,
        balance_usdc: result.new_balance,
        timestamp: new Date(),
      });
    } catch (wsError) {
      console.error("WebSocket emission error:", wsError);
    }

    return sendSuccess(res, {
      message: "Keys sold successfully",
      ...result,
    });
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return sendError(res, error.statusCode, error.message, error.details);
    }
    console.error("Sell keys error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to sell keys. Please try again."
    );
  }
};

/**
 * @route GET /api/key/price/:trader_id
 * @desc Get current key price for a trader
 * @access Public
 */
export const getKeyPrice = async (req: GetKeyPriceRequest, res: Response) => {
  try {
    const { trader_id } = req.params;

    const trader = await UserModel.findById(trader_id);
    if (!trader) {
      return sendNotFound(res, "Trader");
    }

    const supply = Number((trader as any).keys_supply) || 1; // Default to 1 (founder key)
    const currentPrice = getKeyPriceMicroUsdc(supply);
    const nextPrice = getKeyPriceMicroUsdc(supply + 1);

    return sendSuccess(res, {
      trader_id,
      supply,
      current_price: currentPrice,
      next_price: nextPrice,
      price_in_usdc: currentPrice / 1_000_000,
      next_price_in_usdc: nextPrice / 1_000_000,
    });
  } catch (error: any) {
    console.error("Get key price error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to get key price. Please try again."
    );
  }
};

/**
 * @route GET /api/key/ownership/:trader_id
 * @desc Get current user's key ownership for a trader
 * @access Private
 */
export const getKeyOwnership = async (
  req: GetKeyOwnershipRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    const { trader_id } = req.params;

    const quantity = await UserKeyModel.getQuantity(trader_id, userId);

    return sendSuccess(res, {
      trader_id,
      quantity,
      has_keys: quantity > 0,
    });
  } catch (error: any) {
    console.error("Get key ownership error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to get key ownership. Please try again."
    );
  }
};

/**
 * @route POST /api/key/set-required
 * @desc Set the required number of keys to follow trades
 * @access Private
 */
export const setRequiredKeys = async (
  req: SetRequiredKeysRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    const { required_keys } = req.body;

    if (required_keys === undefined || required_keys < 0) {
      return sendValidationError(
        res,
        "Required keys must be a non-negative number"
      );
    }

    // Validate required_keys has at most 6 decimals
    const requiredKeysStr = required_keys.toString();
    const decimalParts = requiredKeysStr.split(".");
    if (decimalParts.length > 1 && decimalParts[1].length > 6) {
      return sendValidationError(
        res,
        "Required keys can have at most 6 decimal places"
      );
    }

    await pool.query(
      `UPDATE users SET required_keys_to_follow = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`,
      [required_keys, userId]
    );

    return sendSuccess(res, {
      message: "Required keys updated successfully",
      required_keys,
    });
  } catch (error: any) {
    console.error("Set required keys error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to set required keys. Please try again."
    );
  }
};

/**
 * @route GET /api/key/holders/:trader_id
 * @desc Get list of key holders for a trader
 * @access Public
 */
export const getKeyHolders = async (
  req: GetKeyHoldersRequest,
  res: Response
) => {
  try {
    const { trader_id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const holders = await UserKeyModel.getHoldersByTrader(trader_id);
    const total = holders.length;
    const paginatedHolders = holders.slice(offset, offset + limit);
    const totalPages = Math.ceil(total / limit);

    // Get user info for each holder
    const holdersWithInfo = await Promise.all(
      paginatedHolders.map(async (key) => {
        const user = await UserModel.findById(key.holder_id);
        return {
          holder_id: key.holder_id,
          quantity: key.quantity,
          username: user?.username,
          display_name: user?.display_name,
          avatar_url: user?.avatar_url,
        };
      })
    );

    return sendSuccess(res, {
      holders: holdersWithInfo,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error: any) {
    console.error("Get key holders error:", error);
    return sendError(
      res,
      500,
      error.message || "Failed to get key holders. Please try again."
    );
  }
};
