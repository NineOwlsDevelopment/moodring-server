import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";

type QueryClient = Pool | PoolClient;

export enum ResolverType {
  PLATFORM = "PLATFORM",
  USER = "USER",
  WITNESS = "WITNESS",
  CONSENSUS = "CONSENSUS",
}

export enum ResolverRole {
  AUTHORITY = "AUTHORITY",
  WITNESS = "WITNESS",
  JUROR = "JUROR",
}

export interface Resolver {
  id: UUID;
  type: ResolverType;
  name: string;
  public_key: string | null;
  bond_balance: number;
  reputation_score: number;
  created_at: Date;
  updated_at: Date;
}

export interface MarketResolver {
  market_id: UUID;
  resolver_id: UUID;
  role: ResolverRole;
  bond_committed: number;
  created_at: Date;
}

export class ResolverModel {
  static async findById(
    id: string,
    client?: QueryClient
  ): Promise<Resolver | null> {
    const db = client || pool;
    const query = "SELECT * FROM resolvers WHERE id = $1";
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByType(
    type: ResolverType,
    client?: QueryClient
  ): Promise<Resolver[]> {
    const db = client || pool;
    const query =
      "SELECT * FROM resolvers WHERE type = $1 ORDER BY reputation_score DESC";
    const result = await db.query(query, [type]);
    return result.rows;
  }

  static async findPlatformResolver(
    client?: QueryClient
  ): Promise<Resolver | null> {
    const db = client || pool;
    const query = "SELECT * FROM resolvers WHERE type = $1 LIMIT 1";
    const result = await db.query(query, [ResolverType.PLATFORM]);
    return result.rows[0] || null;
  }

  static async create(
    data: {
      type: ResolverType;
      name: string;
      public_key?: string | null;
      bond_balance?: number;
      reputation_score?: number;
    },
    client?: QueryClient
  ): Promise<Resolver> {
    const db = client || pool;
    const query = `
      INSERT INTO resolvers (type, name, public_key, bond_balance, reputation_score)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      data.type,
      data.name,
      data.public_key || null,
      data.bond_balance || 0,
      data.reputation_score || 0,
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async updateBond(
    id: string,
    bondDelta: number,
    client?: QueryClient
  ): Promise<Resolver | null> {
    const db = client || pool;
    const query = `
      UPDATE resolvers
      SET bond_balance = bond_balance + $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(query, [bondDelta, id]);
    return result.rows[0] || null;
  }

  static async updateReputation(
    id: string,
    reputationDelta: number,
    client?: QueryClient
  ): Promise<Resolver | null> {
    const db = client || pool;
    const query = `
      UPDATE resolvers
      SET reputation_score = GREATEST(0, reputation_score + $1), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(query, [reputationDelta, id]);
    return result.rows[0] || null;
  }

  static async linkToMarket(
    marketId: string,
    resolverId: string,
    role: ResolverRole,
    bondCommitted: number,
    client?: QueryClient
  ): Promise<MarketResolver> {
    const db = client || pool;
    const query = `
      INSERT INTO market_resolvers (market_id, resolver_id, role, bond_committed)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (market_id, resolver_id) DO UPDATE
      SET role = EXCLUDED.role, bond_committed = EXCLUDED.bond_committed
      RETURNING *
    `;
    const result = await db.query(query, [
      marketId,
      resolverId,
      role,
      bondCommitted,
    ]);
    return result.rows[0];
  }

  static async getMarketResolvers(
    marketId: string,
    client?: QueryClient
  ): Promise<(MarketResolver & { resolver: Resolver })[]> {
    const db = client || pool;
    const query = `
      SELECT mr.*, r.*
      FROM market_resolvers mr
      INNER JOIN resolvers r ON mr.resolver_id = r.id
      WHERE mr.market_id = $1
    `;
    const result = await db.query(query, [marketId]);
    return result.rows.map((row) => ({
      market_id: row.market_id,
      resolver_id: row.resolver_id,
      role: row.role,
      bond_committed: row.bond_committed,
      created_at: row.created_at,
      resolver: {
        id: row.id,
        type: row.type,
        name: row.name,
        public_key: row.public_key,
        bond_balance: row.bond_balance,
        reputation_score: row.reputation_score,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    }));
  }
}
