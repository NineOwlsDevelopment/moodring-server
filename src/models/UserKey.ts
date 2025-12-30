import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";

type QueryClient = Pool | PoolClient;

export interface UserKey {
  id: UUID;
  trader_id: UUID;
  holder_id: UUID;
  quantity: number;
  created_at: number;
  updated_at: number;
}

export interface UserKeyCreateInput {
  trader_id: UUID;
  holder_id: UUID;
  quantity: number;
}

export interface KeyTransaction {
  id: UUID;
  trader_id: UUID;
  buyer_id: UUID;
  transaction_type: "buy" | "sell";
  quantity: number;
  price_per_key: number;
  total_cost: number;
  supply_before: number;
  supply_after: number;
  created_at: number;
}

export interface KeyTransactionCreateInput {
  trader_id: UUID;
  buyer_id: UUID;
  transaction_type: "buy" | "sell";
  quantity: number;
  price_per_key: number;
  total_cost: number;
  supply_before: number;
  supply_after: number;
}

export class UserKeyModel {
  /**
   * Get or create a user key record
   */
  static async getOrCreate(
    traderId: UUID | string,
    holderId: UUID | string,
    client?: QueryClient
  ): Promise<UserKey> {
    const db = client || pool;
    const now = Math.floor(Date.now() / 1000);

    // Try to get existing record
    const existing = await db.query(
      `SELECT * FROM user_keys WHERE trader_id = $1 AND holder_id = $2`,
      [traderId, holderId]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Create new record
    const result = await db.query(
      `INSERT INTO user_keys (trader_id, holder_id, quantity, created_at, updated_at)
       VALUES ($1, $2, 0, $3, $4)
       RETURNING *`,
      [traderId, holderId, now, now]
    );

    return result.rows[0];
  }

  /**
   * Update key quantity for a holder
   */
  static async updateQuantity(
    traderId: UUID | string,
    holderId: UUID | string,
    quantity: number,
    client?: QueryClient
  ): Promise<UserKey> {
    const db = client || pool;
    const now = Math.floor(Date.now() / 1000);

    const result = await db.query(
      `UPDATE user_keys
       SET quantity = $1, updated_at = $2
       WHERE trader_id = $3 AND holder_id = $4
       RETURNING *`,
      [quantity, now, traderId, holderId]
    );

    if (result.rows.length === 0) {
      throw new Error("User key record not found");
    }

    return result.rows[0];
  }

  /**
   * Get key quantity for a holder
   */
  static async getQuantity(
    traderId: UUID | string,
    holderId: UUID | string,
    client?: QueryClient
  ): Promise<number> {
    const db = client || pool;

    const result = await db.query(
      `SELECT quantity FROM user_keys WHERE trader_id = $1 AND holder_id = $2`,
      [traderId, holderId]
    );

    return result.rows[0]?.quantity || 0;
  }

  /**
   * Get total keys held by a user for a trader
   */
  static async getTotalKeysForTrader(
    traderId: UUID | string,
    client?: QueryClient
  ): Promise<number> {
    const db = client || pool;

    const result = await db.query(
      `SELECT COALESCE(SUM(quantity), 0)::int as total FROM user_keys WHERE trader_id = $1`,
      [traderId]
    );

    return result.rows[0]?.total || 0;
  }

  /**
   * Get all keys held by a user
   */
  static async getKeysByHolder(
    holderId: UUID | string,
    client?: QueryClient
  ): Promise<UserKey[]> {
    const db = client || pool;

    const result = await db.query(
      `SELECT * FROM user_keys WHERE holder_id = $1 AND quantity > 0 ORDER BY updated_at DESC`,
      [holderId]
    );

    return result.rows;
  }

  /**
   * Get all holders for a trader
   */
  static async getHoldersByTrader(
    traderId: UUID | string,
    client?: QueryClient
  ): Promise<UserKey[]> {
    const db = client || pool;

    const result = await db.query(
      `SELECT * FROM user_keys WHERE trader_id = $1 AND quantity > 0 ORDER BY quantity DESC`,
      [traderId]
    );

    return result.rows;
  }

  /**
   * Delete key record (when quantity reaches 0)
   */
  static async delete(
    traderId: UUID | string,
    holderId: UUID | string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;

    const result = await db.query(
      `DELETE FROM user_keys WHERE trader_id = $1 AND holder_id = $2 RETURNING id`,
      [traderId, holderId]
    );

    return result.rows.length > 0;
  }
}

export class KeyTransactionModel {
  /**
   * Create a key transaction record
   */
  static async create(
    data: KeyTransactionCreateInput,
    client?: QueryClient
  ): Promise<KeyTransaction> {
    const db = client || pool;
    const now = Math.floor(Date.now() / 1000);

    const result = await db.query(
      `INSERT INTO key_transactions (
        trader_id, buyer_id, transaction_type, quantity,
        price_per_key, total_cost, supply_before, supply_after, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.trader_id,
        data.buyer_id,
        data.transaction_type,
        data.quantity,
        data.price_per_key,
        data.total_cost,
        data.supply_before,
        data.supply_after,
        now,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get transaction history for a trader
   */
  static async getByTrader(
    traderId: UUID | string,
    limit = 50,
    offset = 0,
    client?: QueryClient
  ): Promise<{ transactions: KeyTransaction[]; total: number }> {
    const db = client || pool;

    const [transactionsResult, countResult] = await Promise.all([
      db.query(
        `SELECT * FROM key_transactions
         WHERE trader_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [traderId, limit, offset]
      ),
      db.query(
        `SELECT COUNT(*)::int as count FROM key_transactions WHERE trader_id = $1`,
        [traderId]
      ),
    ]);

    return {
      transactions: transactionsResult.rows,
      total: countResult.rows[0]?.count || 0,
    };
  }

  /**
   * Get transaction history for a buyer
   */
  static async getByBuyer(
    buyerId: UUID | string,
    limit = 50,
    offset = 0,
    client?: QueryClient
  ): Promise<{ transactions: KeyTransaction[]; total: number }> {
    const db = client || pool;

    const [transactionsResult, countResult] = await Promise.all([
      db.query(
        `SELECT * FROM key_transactions
         WHERE buyer_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [buyerId, limit, offset]
      ),
      db.query(
        `SELECT COUNT(*)::int as count FROM key_transactions WHERE buyer_id = $1`,
        [buyerId]
      ),
    ]);

    return {
      transactions: transactionsResult.rows,
      total: countResult.rows[0]?.count || 0,
    };
  }
}

