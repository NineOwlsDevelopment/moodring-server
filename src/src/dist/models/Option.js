"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptionModel = void 0;
const db_1 = require("../db");
class OptionModel {
    static async create(data, client) {
        const { market_id, option_label, option_sub_label = null, option_image_url = null, yes_quantity = 0, no_quantity = 0, } = data;
        const db = client || db_1.pool;
        const now = Math.floor(Date.now() / 1000);
        const query = `
      INSERT INTO market_options (
        market_id,
        option_label,
        option_sub_label,
        option_image_url,
        yes_quantity,
        no_quantity,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      ) RETURNING *
    `;
        const values = [
            market_id,
            option_label,
            option_sub_label,
            option_image_url,
            yes_quantity,
            no_quantity,
            now,
            now,
        ];
        try {
            const result = await db.query(query, values);
            return result.rows[0];
        }
        catch (error) {
            console.error("Error creating option in DB:", error);
            throw error;
        }
    }
    static async findById(id, client) {
        const db = client || db_1.pool;
        const query = "SELECT * FROM market_options WHERE id = $1";
        const result = await db.query(query, [id]);
        return result.rows[0] || null;
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
      UPDATE market_options
      SET ${updates.join(", ")}, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $${paramCount}
      RETURNING *
    `;
        const result = await db.query(query, values);
        return result.rows[0] || null;
    }
    /**
     * Find options by market IDs (batch lookup)
     */
    static async findByMarketIds(marketIds, client) {
        if (!marketIds.length) {
            return {};
        }
        const db = client || db_1.pool;
        const query = `
      SELECT *
      FROM market_options
      WHERE market_id = ANY($1::uuid[])
      ORDER BY market_id, created_at ASC
    `;
        const result = await db.query(query, [marketIds]);
        return result.rows.reduce((acc, option) => {
            if (!acc[option.market_id]) {
                acc[option.market_id] = [];
            }
            acc[option.market_id].push(option);
            return acc;
        }, {});
    }
    /**
     * Find options by market ID
     */
    static async findByMarketId(marketId, client) {
        if (!marketId) {
            return [];
        }
        const db = client || db_1.pool;
        const query = `
      SELECT *
      FROM market_options
      WHERE market_id = $1
      ORDER BY created_at ASC
    `;
        const result = await db.query(query, [marketId]);
        return result.rows;
    }
}
exports.OptionModel = OptionModel;
//# sourceMappingURL=Option.js.map