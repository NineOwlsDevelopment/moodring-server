import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";

type QueryClient = Pool | PoolClient;

export interface Watchlist {
  id: UUID;
  user_id: UUID;
  market_id: UUID;
  created_at: Date;
}

export interface WatchlistCreateInput {
  user_id: UUID | string;
  market_id: UUID | string;
}

export class WatchlistModel {
  /**
   * Add a market to user's watchlist
   */
  static async add(
    data: WatchlistCreateInput,
    client?: QueryClient
  ): Promise<Watchlist> {
    const { user_id, market_id } = data;
    const db = client || pool;

    const query = `
      INSERT INTO watchlist (user_id, market_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, market_id) DO NOTHING
      RETURNING *
    `;

    const result = await db.query(query, [user_id, market_id]);

    if (result.rows[0]) {
      return result.rows[0];
    }

    // If no row returned (conflict), fetch existing
    const existing = await db.query(
      "SELECT * FROM watchlist WHERE user_id = $1 AND market_id = $2",
      [user_id, market_id]
    );
    return existing.rows[0];
  }

  /**
   * Remove a market from user's watchlist
   */
  static async remove(
    user_id: UUID | string,
    market_id: UUID | string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const result = await db.query(
      "DELETE FROM watchlist WHERE user_id = $1 AND market_id = $2 RETURNING id",
      [user_id, market_id]
    );
    return result.rows.length > 0;
  }

  /**
   * Check if a market is in user's watchlist
   */
  static async isWatched(
    user_id: UUID | string,
    market_id: UUID | string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const result = await db.query(
      "SELECT 1 FROM watchlist WHERE user_id = $1 AND market_id = $2 LIMIT 1",
      [user_id, market_id]
    );
    return result.rows.length > 0;
  }

  /**
   * Get all market IDs in user's watchlist
   */
  static async getMarketIds(
    user_id: UUID | string,
    client?: QueryClient
  ): Promise<string[]> {
    const db = client || pool;
    const result = await db.query(
      "SELECT market_id FROM watchlist WHERE user_id = $1 ORDER BY created_at DESC",
      [user_id]
    );
    return result.rows.map((row) => row.market_id);
  }

  /**
   * Get all watchlist entries for a user
   */
  static async findByUserId(
    user_id: UUID | string,
    client?: QueryClient
  ): Promise<Watchlist[]> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM watchlist WHERE user_id = $1 ORDER BY created_at DESC",
      [user_id]
    );
    return result.rows;
  }

  /**
   * Get watchlist status for multiple markets (returns set of market IDs)
   */
  static async getWatchedMarketIds(
    user_id: UUID | string,
    market_ids: string[],
    client?: QueryClient
  ): Promise<Set<string>> {
    if (market_ids.length === 0) {
      return new Set();
    }

    const db = client || pool;
    const result = await db.query(
      "SELECT market_id FROM watchlist WHERE user_id = $1 AND market_id = ANY($2::uuid[])",
      [user_id, market_ids]
    );
    return new Set(result.rows.map((row) => row.market_id));
  }
}
