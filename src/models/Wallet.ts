import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";

type QueryClient = Pool | PoolClient;

export interface Wallet {
  id: UUID;
  user_id: UUID;
  public_key: string;
  balance_sol: number;
  balance_usdc: number;
  circle_wallet_id: string; // Circle wallet ID (required)
  created_at: Date;
  updated_at: Date;
}

export interface WalletCreateInput {
  user_id: UUID;
  circle_wallet_id: string; // Circle wallet ID
  public_key: string; // Wallet public key (address)
}

export class WalletModel {
  /**
   * Create a new wallet for a user (Circle wallet only)
   * @param data - Wallet creation data including user_id and Circle wallet info
   * @param client - Optional database client for transaction support
   * @returns Created wallet
   */
  static async create(
    data: WalletCreateInput,
    client?: QueryClient
  ): Promise<Wallet> {
    const { user_id, circle_wallet_id, public_key } = data;
    const db = client || pool;

    if (!user_id) {
      throw new Error("User ID is required");
    }

    if (!circle_wallet_id || !public_key) {
      throw new Error("Circle wallet ID and public key are required");
    }

    try {
      const result = await db.query(
        `INSERT INTO wallets (user_id, public_key, circle_wallet_id) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [user_id, public_key, circle_wallet_id]
      );

      return result.rows[0];
    } catch (error: any) {
      if (error.code === "23503") {
        throw new Error("User does not exist");
      }
      throw error;
    }
  }

  /**
   * Find wallet by ID
   * @param id - Wallet ID
   * @param client - Optional database client for transaction support
   * @returns Wallet or null
   */
  static async findById(
    id: UUID | string,
    client?: QueryClient
  ): Promise<Wallet | null> {
    const db = client || pool;
    const result = await db.query("SELECT * FROM wallets WHERE id = $1", [id]);

    return result.rows[0] || null;
  }

  /**
   * Find wallet by user ID
   * @param user_id - User ID
   * @param client - Optional database client for transaction support
   * @returns Wallet or null
   */
  static async findByUserId(
    user_id: UUID | string,
    client?: QueryClient
  ): Promise<Wallet | null> {
    const db = client || pool;
    const result = await db.query("SELECT * FROM wallets WHERE user_id = $1", [
      user_id,
    ]);

    return result.rows[0] || null;
  }

  /**
   * Find wallet by public key
   * @param public_key - Wallet public key
   * @param client - Optional database client for transaction support
   * @returns Wallet or null
   */
  static async findByPublicKey(
    public_key: string,
    client?: QueryClient
  ): Promise<Wallet | null> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM wallets WHERE public_key = $1",
      [public_key]
    );

    return result.rows[0] || null;
  }

  /**
   * Delete wallet by ID
   * @param id - Wallet ID
   * @param client - Optional database client for transaction support
   * @returns True if wallet was deleted, false otherwise
   */
  static async delete(
    id: UUID | string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const result = await db.query(
      "DELETE FROM wallets WHERE id = $1 RETURNING id",
      [id]
    );

    return result.rows.length > 0;
  }

  /**
   * Delete wallet by user ID
   * @param user_id - User ID
   * @param client - Optional database client for transaction support
   * @returns True if wallet was deleted, false otherwise
   */
  static async deleteByUserId(
    user_id: UUID | string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const result = await db.query(
      "DELETE FROM wallets WHERE user_id = $1 RETURNING id",
      [user_id]
    );

    return result.rows.length > 0;
  }

  /**
   * Replace user's wallet - deletes old wallet and creates new Circle wallet
   * @param user_id - User ID
   * @param circle_wallet_id - New Circle wallet ID
   * @param public_key - New wallet public key (address)
   * @returns New wallet
   */
  static async replaceWallet(
    user_id: UUID | string,
    circle_wallet_id: string,
    public_key: string
  ): Promise<Wallet> {
    // Use a transaction to ensure atomicity
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Check existing wallet balance before deletion
      const existingWallet = await this.findByUserId(user_id, client);
      if (existingWallet) {
        const hasBalance =
          Number(existingWallet.balance_sol) > 0 ||
          Number(existingWallet.balance_usdc) > 0;

        if (hasBalance) {
          await client.query("ROLLBACK");
          throw new Error(
            "Cannot replace wallet with existing balance. Please withdraw funds first."
          );
        }
      }

      // Delete existing wallet
      await client.query("DELETE FROM wallets WHERE user_id = $1", [user_id]);

      // Create new Circle wallet
      const result = await client.query(
        `INSERT INTO wallets (user_id, public_key, circle_wallet_id) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [user_id, public_key, circle_wallet_id]
      );

      await client.query("COMMIT");

      return result.rows[0];
    } catch (error: any) {
      await client.query("ROLLBACK");
      if (error.code === "23503") {
        throw new Error("User does not exist");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if wallet exists by public key
   * @param public_key - Wallet public key
   * @param client - Optional database client for transaction support
   * @returns True if wallet exists, false otherwise
   */
  static async existsByPublicKey(
    public_key: string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const result = await db.query(
      "SELECT 1 FROM wallets WHERE public_key = $1",
      [public_key]
    );

    return result.rows.length > 0;
  }

  /**
   * Check if user has a wallet
   * @param user_id - User ID
   * @param client - Optional database client for transaction support
   * @returns True if user has a wallet, false otherwise
   */
  static async existsByUserId(
    user_id: UUID | string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const result = await db.query("SELECT 1 FROM wallets WHERE user_id = $1", [
      user_id,
    ]);

    return result.rows.length > 0;
  }

  /**
   * Retrieve all wallets
   * @param client - Optional database client for transaction support
   * @returns Array of wallets
   */
  static async findAll(client?: QueryClient): Promise<Wallet[]> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM wallets ORDER BY created_at ASC"
    );

    return result.rows;
  }

  /**
   * Update wallet balances
   * @param id - Wallet ID
   * @param balances - Partial balance updates
   * @param client - Optional database client for transaction support
   * @returns Updated wallet or null
   */
  static async updateBalances(
    id: UUID | string,
    balances: Partial<Pick<Wallet, "balance_sol" | "balance_usdc">>,
    client?: QueryClient
  ): Promise<Wallet | null> {
    const db = client || pool;
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (balances.balance_sol !== undefined) {
      updates.push(`balance_sol = $${paramCount}`);
      values.push(balances.balance_sol);
      paramCount++;
    }

    if (balances.balance_usdc !== undefined) {
      updates.push(`balance_usdc = $${paramCount}`);
      values.push(balances.balance_usdc);
      paramCount++;
    }

    if (updates.length === 0) {
      return this.findById(id, client);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const query = `
      UPDATE wallets
      SET ${updates.join(", ")}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);

    return result.rows[0] || null;
  }
}
