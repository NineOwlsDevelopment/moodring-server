import { pool } from "../db";
import { Pool, PoolClient } from "pg";

type QueryClient = Pool | PoolClient;

export interface Category {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface CategoryCreateInput {
  name: string;
}

export class CategoryModel {
  static async create(
    data: CategoryCreateInput,
    client?: QueryClient
  ): Promise<Category> {
    const db = client || pool;
    const query = `
      INSERT INTO market_categories (name)
      VALUES ($1)
      RETURNING *
    `;

    const values = [data.name];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByName(
    name: string,
    client?: QueryClient
  ): Promise<Category | null> {
    const db = client || pool;
    const query = `
      SELECT *
      FROM market_categories
      WHERE LOWER(name) = LOWER($1)
      LIMIT 1
    `;

    const result = await db.query(query, [name]);
    return result.rows[0] || null;
  }

  static async findAll(client?: QueryClient): Promise<Category[]> {
    const db = client || pool;
    const query = `
      SELECT *
      FROM market_categories
      ORDER BY name ASC
    `;

    const result = await db.query(query);
    return result.rows;
  }

  static async findById(
    id: string,
    client?: QueryClient
  ): Promise<Category | null> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM market_categories WHERE id = $1",
      [id]
    );
    return result.rows[0] || null;
  }

  static async delete(id: string, client?: QueryClient): Promise<boolean> {
    const db = client || pool;
    const result = await db.query(
      "DELETE FROM market_categories WHERE id = $1 RETURNING id",
      [id]
    );
    return result.rows.length > 0;
  }

  static async update(
    id: string,
    name: string,
    client?: QueryClient
  ): Promise<Category | null> {
    const db = client || pool;
    const result = await db.query(
      `
      UPDATE market_categories
      SET name = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `,
      [name, id]
    );
    return result.rows[0] || null;
  }
}
