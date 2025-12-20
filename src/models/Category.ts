import { pool } from "../db";
import { Pool, PoolClient } from "pg";

type QueryClient = Pool | PoolClient;

export interface Category {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
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
      SET name = $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $2
      RETURNING *
    `,
      [name, id]
    );
    return result.rows[0] || null;
  }
}
