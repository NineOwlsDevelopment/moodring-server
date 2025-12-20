import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { Category } from "./Category";
import { UUID } from "crypto";
import { ResolutionMode, MarketStatus } from "./Resolution";

type QueryClient = Pool | PoolClient;

export interface Market {
  id: UUID;
  creator_id: UUID;
  creator_fees_collected: number;
  protocol_fees_collected: number;
  question: string;
  market_description: string;
  image_url: string;
  expiration_timestamp: number;
  designated_resolver: string | null;
  total_options: number;
  total_volume: number;
  resolved_options: number;
  total_open_interest: number;
  shared_pool_liquidity: number;
  shared_pool_vault: string;
  total_shared_lp_shares: number;
  accumulated_lp_fees: number;
  liquidity_parameter: number;
  base_liquidity_parameter: number;
  lp_token_mint: string | null;
  is_binary: boolean;
  is_verified: boolean;
  is_resolved: boolean;
  is_initialized: boolean;
  is_featured: boolean;
  featured_order: number | null;
  trending_score: number;
  // Resolution fields
  resolution_mode: ResolutionMode | null;
  bond_amount: number;
  status: MarketStatus;
  created_at: number;
  updated_at: number;
}

export interface MarketWithCategories extends Market {
  categories: Category[];
}

export interface MarketCreateInput {
  creator_id: UUID;
  question: string;
  market_description: string;
  image_url: string;
  expiration_timestamp: number;
  designated_resolver?: string | null;
  shared_pool_vault: string;
  is_binary: boolean;
  is_verified?: boolean;
  is_resolved?: boolean;
  is_initialized?: boolean;
  category_ids?: string[];
  // Resolution fields (required)
  resolution_mode: ResolutionMode;
  bond_amount?: number;
  // Optional liquidity fields (defaults to 0)
  liquidity_parameter?: number;
  base_liquidity_parameter?: number;
  shared_pool_liquidity?: number;
  total_shared_lp_shares?: number;
}

export class MarketModel {
  static async create(
    data: MarketCreateInput,
    client?: QueryClient
  ): Promise<Market> {
    const {
      creator_id,
      question,
      market_description,
      image_url,
      expiration_timestamp,
      designated_resolver = null,
      shared_pool_vault,
      is_binary,
      is_verified = false,
      is_resolved = false,
      is_initialized = false,
      category_ids = [],
      resolution_mode,
      bond_amount = 0,
      liquidity_parameter = 0,
      base_liquidity_parameter = 0,
      shared_pool_liquidity = 0,
      total_shared_lp_shares = 0,
    } = data;
    const db = client || pool;

    // Validate resolution mode is provided
    if (!resolution_mode) {
      throw new Error("Resolution mode is required for market creation");
    }

    const now = Math.floor(Date.now() / 1000);

    const query = `
      INSERT INTO markets (
        creator_id,
        question,
        market_description,
        image_url,
        expiration_timestamp,
        designated_resolver,
        shared_pool_vault,
        is_binary,
        is_verified,
        is_resolved,
        is_initialized,
        liquidity_parameter,
        base_liquidity_parameter,
        shared_pool_liquidity,
        total_shared_lp_shares,
        resolution_mode,
        bond_amount,
        status,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      ) RETURNING *
    `;

    const values = [
      creator_id,
      question,
      market_description,
      image_url,
      expiration_timestamp,
      designated_resolver,
      shared_pool_vault,
      is_binary,
      is_verified,
      is_resolved,
      is_initialized,
      liquidity_parameter,
      base_liquidity_parameter,
      shared_pool_liquidity,
      total_shared_lp_shares,
      resolution_mode,
      bond_amount,
      "OPEN",
      now,
      now,
    ];

    try {
      const result = await db.query(query, values);
      const market = result.rows[0];

      // Link categories if provided
      if (category_ids && category_ids.length > 0) {
        await this.linkCategories(market.id, category_ids, client);
      }

      return market;
    } catch (error) {
      console.error("Error creating market in DB:", error);
      throw error;
    }
  }

  /**
   * Link multiple categories to a market
   */
  static async linkCategories(
    marketId: string,
    categoryIds: string[],
    client?: QueryClient
  ): Promise<void> {
    if (!categoryIds || categoryIds.length === 0) return;
    const db = client || pool;

    const values: any[] = [];
    const placeholders: string[] = [];

    categoryIds.forEach((categoryId, index) => {
      const offset = index * 2;
      placeholders.push(`($${offset + 1}, $${offset + 2})`);
      values.push(marketId, categoryId);
    });

    const now = Math.floor(Date.now() / 1000);
    // Add created_at to each pair of values
    const valuesWithTimestamps: any[] = [];
    for (let i = 0; i < values.length; i += 2) {
      valuesWithTimestamps.push(values[i], values[i + 1], now);
    }
    const placeholdersWithTimestamp: string[] = [];
    for (let i = 0; i < categoryIds.length; i++) {
      const offset = i * 3;
      placeholdersWithTimestamp.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3})`
      );
    }

    const query = `
      INSERT INTO market_category_links (market_id, category_id, created_at)
      VALUES ${placeholdersWithTimestamp.join(", ")}
      ON CONFLICT (market_id, category_id) DO NOTHING
    `;

    await db.query(query, valuesWithTimestamps);
  }

  /**
   * Unlink a category from a market
   */
  static async unlinkCategory(
    marketId: string,
    categoryId: string,
    client?: QueryClient
  ): Promise<void> {
    const db = client || pool;
    const query = `
      DELETE FROM market_category_links
      WHERE market_id = $1 AND category_id = $2
    `;
    await db.query(query, [marketId, categoryId]);
  }

  /**
   * Get all categories for a market
   */
  static async getCategories(
    marketId: string,
    client?: QueryClient
  ): Promise<Category[]> {
    const db = client || pool;
    const query = `
      SELECT mc.*
      FROM market_categories mc
      INNER JOIN market_category_links mcl ON mc.id = mcl.category_id
      WHERE mcl.market_id = $1
      ORDER BY mc.name ASC
    `;
    const result = await db.query(query, [marketId]);
    return result.rows;
  }

  /**
   * Set categories for a market (replaces existing)
   */
  static async setCategories(
    marketId: string,
    categoryIds: string[],
    client?: QueryClient
  ): Promise<void> {
    const db = client || pool;
    // Remove all existing links
    await db.query("DELETE FROM market_category_links WHERE market_id = $1", [
      marketId,
    ]);

    // Add new links
    if (categoryIds && categoryIds.length > 0) {
      await this.linkCategories(marketId, categoryIds, client);
    }
  }

  /**
   * Find market by UUID id
   */
  static async findById(
    id: string,
    client?: QueryClient
  ): Promise<Market | null> {
    const db = client || pool;
    const query = "SELECT * FROM markets WHERE id = $1";
    const result = await db.query(query, [id]);
    if (!result.rows[0]) return null;

    const market = result.rows[0];
    // Parse JSON fields
    return market;
  }

  /**
   * Find markets by creator_id
   */
  static async findByCreator(
    creatorId: string,
    client?: QueryClient
  ): Promise<Market[]> {
    const db = client || pool;
    const query =
      "SELECT * FROM markets WHERE creator_id = $1 ORDER BY created_at DESC";
    const result = await db.query(query, [creatorId]);
    return result.rows;
  }

  static async update(
    id: string,
    data: Partial<Market>,
    client?: QueryClient
  ): Promise<Market | null> {
    const db = client || pool;
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (key !== "id" && value !== undefined) {
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (updates.length === 0) return null;

    values.push(id);
    const query = `
      UPDATE markets
      SET ${updates.join(", ")}, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  static async findPaginated(
    page = 1,
    limit = 20,
    client?: QueryClient
  ): Promise<{ markets: Market[]; total: number }> {
    const db = client || pool;
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 20;
    const offset = (safePage - 1) * safeLimit;

    const [marketsResult, countResult] = await Promise.all([
      db.query(
        `
        SELECT *
        FROM markets
        ORDER BY created_at DESC, total_volume DESC
        LIMIT $1 OFFSET $2
      `,
        [safeLimit, offset]
      ),
      db.query(`SELECT COUNT(*)::int AS count FROM markets`),
    ]);

    const total = Number(countResult.rows[0]?.count ?? 0);

    return {
      markets: marketsResult.rows,
      total,
    };
  }
}
