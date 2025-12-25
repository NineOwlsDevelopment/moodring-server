"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryModel = void 0;
const db_1 = require("../db");
class CategoryModel {
    static async create(data, client) {
        const db = client || db_1.pool;
        const now = Math.floor(Date.now() / 1000);
        const query = `
      INSERT INTO market_categories (name, created_at, updated_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
        const values = [data.name, now, now];
        const result = await db.query(query, values);
        return result.rows[0];
    }
    static async findByName(name, client) {
        const db = client || db_1.pool;
        const query = `
      SELECT *
      FROM market_categories
      WHERE LOWER(name) = LOWER($1)
      LIMIT 1
    `;
        const result = await db.query(query, [name]);
        return result.rows[0] || null;
    }
    static async findAll(client) {
        const db = client || db_1.pool;
        const query = `
      SELECT *
      FROM market_categories
      ORDER BY name ASC
    `;
        const result = await db.query(query);
        return result.rows;
    }
    static async findById(id, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM market_categories WHERE id = $1", [id]);
        return result.rows[0] || null;
    }
    static async delete(id, client) {
        const db = client || db_1.pool;
        const result = await db.query("DELETE FROM market_categories WHERE id = $1 RETURNING id", [id]);
        return result.rows.length > 0;
    }
    static async update(id, name, client) {
        const db = client || db_1.pool;
        const result = await db.query(`
      UPDATE market_categories
      SET name = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $2
      RETURNING *
    `, [name, id]);
        return result.rows[0] || null;
    }
}
exports.CategoryModel = CategoryModel;
//# sourceMappingURL=Category.js.map