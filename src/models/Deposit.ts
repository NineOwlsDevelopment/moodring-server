import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";

type QueryClient = Pool | PoolClient;

export interface WalletDeposit {
  id: UUID;
  wallet_id: UUID;
  user_id: UUID;
  signature: string;
  slot: number | null;
  block_time: Date | null;
  amount: number;
  token_symbol: string;
  source: string | null;
  status: string;
  raw: any;
  created_at: Date;
  updated_at: Date;
}

export interface DepositCreateInput {
  wallet_id: UUID | string;
  user_id: UUID | string;
  signature: string;
  slot?: number | null;
  block_time?: Date | null;
  amount: number;
  token_symbol?: string;
  source?: string | null;
  status?: string;
  raw?: Record<string, any> | null;
}

export class DepositModel {
  static async findBySignature(
    signature: string,
    client?: QueryClient
  ): Promise<WalletDeposit | null> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM wallet_deposits WHERE signature = $1",
      [signature]
    );

    return result.rows[0] || null;
  }

  static async findExistingSignatures(
    signatures: string[],
    client?: QueryClient
  ): Promise<Set<string>> {
    if (!signatures.length) {
      return new Set();
    }
    const db = client || pool;

    const result = await db.query(
      "SELECT signature FROM wallet_deposits WHERE signature = ANY($1)",
      [signatures]
    );

    return new Set(result.rows.map((row) => row.signature));
  }

  static async recordDeposit(
    data: DepositCreateInput,
    client?: QueryClient
  ): Promise<WalletDeposit | null> {
    const {
      wallet_id,
      user_id,
      signature,
      slot = null,
      block_time = null,
      amount,
      token_symbol = "SOL",
      source = null,
      status = "confirmed",
      raw = null,
    } = data;
    const db = client || pool;

    const result = await db.query(
      `INSERT INTO wallet_deposits (
        wallet_id,
        user_id,
        signature,
        slot,
        block_time,
        amount,
        token_symbol,
        source,
        status,
        raw
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (signature) DO NOTHING
      RETURNING *`,
      [
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
      ]
    );

    return result.rows[0] || null;
  }
}
