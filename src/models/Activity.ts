import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";

type QueryClient = Pool | PoolClient;

export type ActivityType =
  | "trade"
  | "market_created"
  | "market_initialized"
  | "market_resolved"
  | "liquidity_added"
  | "liquidity_removed"
  | "lp_rewards_claimed"
  | "claim"
  | "comment"
  | "user_joined"
  | "deposit"
  | "withdrawal";

export type EntityType = "market" | "option" | "trade" | "user" | "comment";

export interface Activity {
  id: UUID;
  user_id: UUID | null;
  activity_type: ActivityType;
  entity_type: EntityType | null;
  entity_id: string | null;
  metadata: Record<string, any> | null;
  is_public: boolean;
  created_at: Date;
}

export interface ActivityCreateInput {
  user_id?: UUID | null;
  activity_type: ActivityType;
  entity_type?: EntityType;
  entity_id?: string;
  metadata?: Record<string, any>;
  is_public?: boolean;
}

export interface ActivityWithUser extends Activity {
  username?: string;
  display_name?: string;
  avatar_url?: string | null;
  market_id?: string;
  market_question?: string;
}

export class ActivityModel {
  static async create(
    data: ActivityCreateInput,
    client?: QueryClient
  ): Promise<Activity> {
    const {
      user_id = null,
      activity_type,
      entity_type = null,
      entity_id = null,
      metadata = null,
      is_public = true,
    } = data;
    const db = client || pool;

    const query = `
      INSERT INTO activities (user_id, activity_type, entity_type, entity_id, metadata, is_public)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await db.query(query, [
      user_id,
      activity_type,
      entity_type,
      entity_id,
      metadata ? JSON.stringify(metadata) : null,
      is_public,
    ]);
    return result.rows[0];
  }

  static async getPublicFeed(
    limit = 50,
    offset = 0,
    client?: QueryClient
  ): Promise<ActivityWithUser[]> {
    const db = client || pool;
    const result = await db.query(
      `
      SELECT 
        a.*, 
        u.username, 
        u.display_name,
        u.avatar_url,
        CASE 
          WHEN a.entity_type = 'market' THEN a.entity_id::text
          WHEN a.metadata->>'market_id' IS NOT NULL THEN a.metadata->>'market_id'
          ELSE NULL
        END as market_id,
        m.question as market_question
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT question 
        FROM markets 
        WHERE (
          (a.entity_type = 'market' AND id::text = a.entity_id) OR
          (a.metadata->>'market_id' IS NOT NULL AND id::text = a.metadata->>'market_id')
        )
        LIMIT 1
      ) m ON true
      WHERE a.is_public = TRUE
      ORDER BY a.created_at DESC
      LIMIT $1 OFFSET $2
    `,
      [limit, offset]
    );
    return result.rows;
  }

  static async getUserActivity(
    userId: UUID | string,
    limit = 50,
    offset = 0,
    activityType?: ActivityType,
    client?: QueryClient
  ): Promise<ActivityWithUser[]> {
    const db = client || pool;
    const typeFilter = activityType ? "AND a.activity_type = $4" : "";
    const params = activityType
      ? [userId, limit, offset, activityType]
      : [userId, limit, offset];

    const result = await db.query(
      `
      SELECT 
        a.*,
        u.username,
        u.display_name,
        u.avatar_url
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.user_id = $1 ${typeFilter}
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET $3
    `,
      params
    );
    return result.rows;
  }

  static async getMarketActivity(
    marketId: string,
    limit = 50,
    offset = 0,
    client?: QueryClient
  ): Promise<ActivityWithUser[]> {
    const db = client || pool;
    const result = await db.query(
      `
      SELECT 
        a.*, 
        u.username, 
        u.display_name,
        u.avatar_url,
        $1::text as market_id,
        m.question as market_question
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN markets m ON m.id::text = $1
      WHERE (a.entity_type = 'market' AND a.entity_id::text = $1)
         OR (a.entity_type = 'option' AND a.metadata->>'market_id' = $1)
         OR (a.entity_type = 'trade' AND a.metadata->>'market_id' = $1)
         OR (a.entity_id::text = $1)
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [marketId, limit, offset]
    );
    return result.rows;
  }

  static async getByType(
    activityType: ActivityType,
    limit = 50,
    offset = 0,
    client?: QueryClient
  ): Promise<ActivityWithUser[]> {
    const db = client || pool;
    const result = await db.query(
      `
      SELECT 
        a.*, 
        u.username, 
        u.display_name,
        u.avatar_url,
        CASE 
          WHEN a.entity_type = 'market' THEN a.entity_id::text
          WHEN a.metadata->>'market_id' IS NOT NULL THEN a.metadata->>'market_id'
          ELSE NULL
        END as market_id,
        m.question as market_question
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT question 
        FROM markets 
        WHERE (
          (a.entity_type = 'market' AND id::text = a.entity_id) OR
          (a.metadata->>'market_id' IS NOT NULL AND id::text = a.metadata->>'market_id')
        )
        LIMIT 1
      ) m ON true
      WHERE a.activity_type = $1 AND a.is_public = TRUE
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [activityType, limit, offset]
    );
    return result.rows;
  }

  static async getRecentByEntity(
    entityType: EntityType,
    entityId: string,
    limit = 20,
    client?: QueryClient
  ): Promise<ActivityWithUser[]> {
    const db = client || pool;
    const result = await db.query(
      `
      SELECT a.*, u.username, u.display_name, u.avatar_url
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.entity_type = $1 AND a.entity_id = $2
      ORDER BY a.created_at DESC
      LIMIT $3
    `,
      [entityType, entityId, limit]
    );
    return result.rows;
  }
}
