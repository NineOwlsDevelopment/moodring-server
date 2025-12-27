"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepositModel = void 0;
const db_1 = require("../db");
class DepositModel {
    static async findBySignature(signature, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM wallet_deposits WHERE signature = $1", [signature]);
        return result.rows[0] || null;
    }
    static async findExistingSignatures(signatures, client) {
        if (!signatures.length) {
            return new Set();
        }
        const db = client || db_1.pool;
        const result = await db.query("SELECT signature FROM wallet_deposits WHERE signature = ANY($1)", [signatures]);
        return new Set(result.rows.map((row) => row.signature));
    }
    static async recordDeposit(data, client) {
        const { wallet_id, user_id, signature, slot = null, block_time = null, amount, token_symbol = "SOL", source = null, status = "confirmed", raw = null, } = data;
        const db = client || db_1.pool;
        const now = Math.floor(Date.now() / 1000);
        const result = await db.query(`INSERT INTO wallet_deposits (
        wallet_id,
        user_id,
        signature,
        slot,
        block_time,
        amount,
        token_symbol,
        source,
        status,
        raw,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (signature) DO NOTHING
      RETURNING *`, [
            wallet_id,
            user_id,
            signature,
            slot,
            block_time,
            amount,
            token_symbol,
            source,
            status,
            raw ? JSON.stringify(raw) : null,
            now,
            now,
        ]);
        return result.rows[0] || null;
    }
}
exports.DepositModel = DepositModel;
//# sourceMappingURL=Deposit.js.map