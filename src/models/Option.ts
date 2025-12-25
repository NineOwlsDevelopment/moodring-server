import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";

type QueryClient = Pool | PoolClient;

export interface Option {
  id: UUID;
  market_id: UUID;
  option_label: string;
  option_sub_label: string | null;
  option_image_url: string | null;
  yes_quantity: number;
  no_quantity: number;
  is_resolved: boolean;
  winning_side: number | null;
  resolved_at: number;
  resolved_reason: string | null;
  resolved_by: string | null;
  dispute_deadline: number;
  created_at: number;
  updated_at: number;
}

export interface OptionCreateInput {
  market_id: UUID;
  option_label: string;
  option_sub_label?: string | null;
  option_image_url?: string | null;
  yes_quantity?: number;
  no_quantity?: number;
}

export class OptionModel {
  static async create(
    data: OptionCreateInput,
    client?: QueryClient
  ): Promise<Option> {
    const {
      market_id,
      option_label,
      option_sub_label = null,
      option_image_url = null,
      yes_quantity = 0,
      no_quantity = 0,
    } = data;
    const db = client || pool;
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
    } catch (error) {
      console.error("Error creating option in DB:", error);
      throw error;
    }
  }

  static async findById(
    id: string,
    client?: QueryClient
  ): Promise<Option | null> {
    const db = client || pool;
    const query = "SELECT * FROM market_options WHERE id = $1";
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  static async update(
    id: string,
    data: Partial<Option>,
    client?: QueryClient
  ): Promise<Option | null> {
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
  static async findByMarketIds(
    marketIds: string[],
    client?: QueryClient
  ): Promise<Record<string, Option[]>> {
    if (!marketIds.length) {
      return {};
    }
    const db = client || pool;

    const query = `
      SELECT *
      FROM market_options
      WHERE market_id = ANY($1::uuid[])
      ORDER BY market_id, created_at ASC
    `;

    const result = await db.query(query, [marketIds]);
    return result.rows.reduce<Record<string, Option[]>>((acc, option) => {
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
  static async findByMarketId(
    marketId: string,
    client?: QueryClient
  ): Promise<Option[]> {
    if (!marketId) {
      return [];
    }
    const db = client || pool;

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
