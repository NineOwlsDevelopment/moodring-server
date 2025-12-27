"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletModel = void 0;
const db_1 = require("../db");
class WalletModel {
    /**
     * Create a new wallet for a user (Circle wallet only)
     * @param data - Wallet creation data including user_id and Circle wallet info
     * @param client - Optional database client for transaction support
     * @returns Created wallet
     */
    static async create(data, client) {
        const { user_id, circle_wallet_id, public_key } = data;
        const db = client || db_1.pool;
        if (!user_id) {
            throw new Error("User ID is required");
        }
        if (!circle_wallet_id || !public_key) {
            throw new Error("Circle wallet ID and public key are required");
        }
        const now = Math.floor(Date.now() / 1000);
        try {
            const result = await db.query(`INSERT INTO wallets (user_id, public_key, circle_wallet_id, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`, [user_id, public_key, circle_wallet_id, now, now]);
            return result.rows[0];
        }
        catch (error) {
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
    static async findById(id, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM wallets WHERE id = $1", [id]);
        return result.rows[0] || null;
    }
    /**
     * Find wallet by user ID
     * @param user_id - User ID
     * @param client - Optional database client for transaction support
     * @returns Wallet or null
     */
    static async findByUserId(user_id, client) {
        const db = client || db_1.pool;
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
    static async findByPublicKey(public_key, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM wallets WHERE public_key = $1", [public_key]);
        return result.rows[0] || null;
    }
    /**
     * Delete wallet by ID
     * @param id - Wallet ID
     * @param client - Optional database client for transaction support
     * @returns True if wallet was deleted, false otherwise
     */
    static async delete(id, client) {
        const db = client || db_1.pool;
        const result = await db.query("DELETE FROM wallets WHERE id = $1 RETURNING id", [id]);
        return result.rows.length > 0;
    }
    /**
     * Delete wallet by user ID
     * @param user_id - User ID
     * @param client - Optional database client for transaction support
     * @returns True if wallet was deleted, false otherwise
     */
    static async deleteByUserId(user_id, client) {
        const db = client || db_1.pool;
        const result = await db.query("DELETE FROM wallets WHERE user_id = $1 RETURNING id", [user_id]);
        return result.rows.length > 0;
    }
    /**
     * Replace user's wallet - deletes old wallet and creates new Circle wallet
     * @param user_id - User ID
     * @param circle_wallet_id - New Circle wallet ID
     * @param public_key - New wallet public key (address)
     * @returns New wallet
     */
    static async replaceWallet(user_id, circle_wallet_id, public_key) {
        // Use a transaction to ensure atomicity
        const client = await db_1.pool.connect();
        try {
            await client.query("BEGIN");
            // Check existing wallet balance before deletion
            const existingWallet = await this.findByUserId(user_id, client);
            if (existingWallet) {
                const hasBalance = Number(existingWallet.balance_sol) > 0 ||
                    Number(existingWallet.balance_usdc) > 0;
                if (hasBalance) {
                    await client.query("ROLLBACK");
                    throw new Error("Cannot replace wallet with existing balance. Please withdraw funds first.");
                }
            }
            // Delete existing wallet
            await client.query("DELETE FROM wallets WHERE user_id = $1", [user_id]);
            // Create new Circle wallet
            const now = Math.floor(Date.now() / 1000);
            const result = await client.query(`INSERT INTO wallets (user_id, public_key, circle_wallet_id, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`, [user_id, public_key, circle_wallet_id, now, now]);
            await client.query("COMMIT");
            return result.rows[0];
        }
        catch (error) {
            await client.query("ROLLBACK");
            if (error.code === "23503") {
                throw new Error("User does not exist");
            }
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Check if wallet exists by public key
     * @param public_key - Wallet public key
     * @param client - Optional database client for transaction support
     * @returns True if wallet exists, false otherwise
     */
    static async existsByPublicKey(public_key, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT 1 FROM wallets WHERE public_key = $1", [public_key]);
        return result.rows.length > 0;
    }
    /**
     * Check if user has a wallet
     * @param user_id - User ID
     * @param client - Optional database client for transaction support
     * @returns True if user has a wallet, false otherwise
     */
    static async existsByUserId(user_id, client) {
        const db = client || db_1.pool;
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
    static async findAll(client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM wallets ORDER BY created_at ASC");
        return result.rows;
    }
    /**
     * Update wallet balances
     * @param id - Wallet ID
     * @param balances - Partial balance updates
     * @param client - Optional database client for transaction support
     * @returns Updated wallet or null
     */
    static async updateBalances(id, balances, client) {
        const db = client || db_1.pool;
        const updates = [];
        const values = [];
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
        updates.push("updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT");
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
exports.WalletModel = WalletModel;
//# sourceMappingURL=Wallet.js.map