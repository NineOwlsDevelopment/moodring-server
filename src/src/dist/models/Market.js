"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketModel = void 0;
const db_1 = require("../db");
class MarketModel {
    static async create(data, client) {
        const { creator_id, question, market_description, image_url, expiration_timestamp, shared_pool_vault, is_binary, is_verified = false, is_resolved = false, is_initialized = false, category_ids = [], resolution_mode, bond_amount = 0, liquidity_parameter = 0, base_liquidity_parameter = 0, shared_pool_liquidity = 0, total_shared_lp_shares = 0, } = data;
        const db = client || db_1.pool;
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
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING *
    `;
        const values = [
            creator_id,
            question,
            market_description,
            image_url,
            expiration_timestamp,
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
        }
        catch (error) {
            console.error("Error creating market in DB:", error);
            throw error;
        }
    }
    /**
     * Link multiple categories to a market
     */
    static async linkCategories(marketId, categoryIds, client) {
        if (!categoryIds || categoryIds.length === 0)
            return;
        const db = client || db_1.pool;
        const values = [];
        const placeholders = [];
        categoryIds.forEach((categoryId, index) => {
            const offset = index * 2;
            placeholders.push(`($${offset + 1}, $${offset + 2})`);
            values.push(marketId, categoryId);
        });
        const now = Math.floor(Date.now() / 1000);
        // Add created_at to each pair of values
        const valuesWithTimestamps = [];
        for (let i = 0; i < values.length; i += 2) {
            valuesWithTimestamps.push(values[i], values[i + 1], now);
        }
        const placeholdersWithTimestamp = [];
        for (let i = 0; i < categoryIds.length; i++) {
            const offset = i * 3;
            placeholdersWithTimestamp.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
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
    static async unlinkCategory(marketId, categoryId, client) {
        const db = client || db_1.pool;
        const query = `
      DELETE FROM market_category_links
      WHERE market_id = $1 AND category_id = $2
    `;
        await db.query(query, [marketId, categoryId]);
    }
    /**
     * Get all categories for a market
     */
    static async getCategories(marketId, client) {
        const db = client || db_1.pool;
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
    static async setCategories(marketId, categoryIds, client) {
        const db = client || db_1.pool;
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
    static async findById(id, client) {
        const db = client || db_1.pool;
        const query = "SELECT * FROM markets WHERE id = $1";
        const result = await db.query(query, [id]);
        if (!result.rows[0])
            return null;
        const market = result.rows[0];
        // Parse JSON fields
        return market;
    }
    /**
     * Find markets by creator_id
     */
    static async findByCreator(creatorId, client) {
        const db = client || db_1.pool;
        const query = "SELECT * FROM markets WHERE creator_id = $1 ORDER BY created_at DESC";
        const result = await db.query(query, [creatorId]);
        return result.rows;
    }
    static async update(id, data, client) {
        const db = client || db_1.pool;
        const updates = [];
        const values = [];
        let paramCount = 1;
        Object.entries(data).forEach(([key, value]) => {
            if (key !== "id" && value !== undefined) {
                updates.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        });
        if (updates.length === 0)
            return null;
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
    static async findPaginated(page = 1, limit = 20, client) {
        const db = client || db_1.pool;
        const safePage = Number.isInteger(page) && page > 0 ? page : 1;
        const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 20;
        const offset = (safePage - 1) * safeLimit;
        const [marketsResult, countResult] = await Promise.all([
            db.query(`
        SELECT *
        FROM markets
        ORDER BY created_at DESC, total_volume DESC
        LIMIT $1 OFFSET $2
      `, [safeLimit, offset]),
            db.query(`SELECT COUNT(*)::int AS count FROM markets`),
        ]);
        const total = Number(countResult.rows[0]?.count ?? 0);
        return {
            markets: marketsResult.rows,
            total,
        };
    }
}
exports.MarketModel = MarketModel;
//# sourceMappingURL=Market.js.map