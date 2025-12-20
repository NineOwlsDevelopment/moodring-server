import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";
import { parseJsonb, prepareJsonb } from "../utils/json";

type QueryClient = Pool | PoolClient;

export enum ResolutionMode {
  ORACLE = "ORACLE",
  AUTHORITY = "AUTHORITY",
  OPINION = "OPINION",
}

export enum MarketStatus {
  OPEN = "OPEN",
  RESOLVING = "RESOLVING",
  RESOLVED = "RESOLVED",
  DISPUTED = "DISPUTED",
}

export interface ResolutionSubmission {
  id: UUID;
  market_id: UUID;
  user_id: UUID;
  outcome: string;
  evidence: any | null;
  signature: string | null;
  submitted_at: Date;
}

export interface MarketResolution {
  market_id: UUID;
  final_outcome: string;
  resolution_mode: ResolutionMode;
  resolver_summary: any;
  resolution_trace: any;
  canonical_hash: string;
  resolved_at: Date;
}

export interface ResolutionConfig {
  // For ORACLE: platform admins resolve
  // For AUTHORITY: creator or admin can resolve
  // Additional configuration options
  quorumSize?: number;
  minJurors?: number;
  consensusThreshold?: number;
  // For OPINION: snapshot_timestamp
  snapshotTimestamp?: number;
  // Common: bond_amount, dispute_window_hours
  bondAmount?: number;
  disputeWindowHours?: number;
  // Escalation path
  escalationPath?: string;
}

export class ResolutionSubmissionModel {
  static async create(
    data: {
      market_id: string;
      user_id: string;
      outcome: string;
      evidence?: any;
      signature?: string;
    },
    client?: QueryClient
  ): Promise<ResolutionSubmission> {
    const db = client || pool;

    const query = `
      INSERT INTO resolution_submissions (market_id, user_id, outcome, evidence, signature)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      data.market_id,
      data.user_id,
      data.outcome,
      prepareJsonb(data.evidence),
      data.signature || null,
    ];
    const result = await db.query(query, values);
    return {
      ...result.rows[0],
      evidence: parseJsonb(result.rows[0].evidence),
    };
  }

  static async findByMarket(
    marketId: string,
    client?: QueryClient
  ): Promise<ResolutionSubmission[]> {
    const db = client || pool;
    const query = `
      SELECT * FROM resolution_submissions
      WHERE market_id = $1
      ORDER BY submitted_at DESC
    `;
    const result = await db.query(query, [marketId]);
    return result.rows.map((row) => ({
      ...row,
      evidence: parseJsonb(row.evidence),
    }));
  }

  static async findByUser(
    userId: string,
    marketId: string,
    client?: QueryClient
  ): Promise<ResolutionSubmission | null> {
    const db = client || pool;
    const query = `
      SELECT * FROM resolution_submissions
      WHERE user_id = $1 AND market_id = $2
      ORDER BY submitted_at DESC
      LIMIT 1
    `;
    const result = await db.query(query, [userId, marketId]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...row,
      evidence: parseJsonb(row.evidence),
    };
  }
}

export class MarketResolutionModel {
  static async create(
    data: {
      market_id: string;
      final_outcome: string;
      resolution_mode: ResolutionMode;
      resolver_summary: any;
      resolution_trace: any;
      canonical_hash: string;
    },
    client?: QueryClient
  ): Promise<MarketResolution> {
    const db = client || pool;
    const query = `
      INSERT INTO market_resolutions (
        market_id, final_outcome, resolution_mode,
        resolver_summary, resolution_trace, canonical_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      data.market_id,
      data.final_outcome,
      data.resolution_mode,
      prepareJsonb(data.resolver_summary),
      prepareJsonb(data.resolution_trace),
      data.canonical_hash,
    ];
    const result = await db.query(query, values);
    return {
      ...result.rows[0],
      resolver_summary: parseJsonb(result.rows[0].resolver_summary),
      resolution_trace: parseJsonb(result.rows[0].resolution_trace),
    };
  }

  static async findByMarket(
    marketId: string,
    client?: QueryClient
  ): Promise<MarketResolution | null> {
    const db = client || pool;
    const query = "SELECT * FROM market_resolutions WHERE market_id = $1";
    const result = await db.query(query, [marketId]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...row,
      resolver_summary: parseJsonb(row.resolver_summary),
      resolution_trace: parseJsonb(row.resolution_trace),
    };
  }

  static async findByHash(
    hash: string,
    client?: QueryClient
  ): Promise<MarketResolution | null> {
    const db = client || pool;
    const query = "SELECT * FROM market_resolutions WHERE canonical_hash = $1";
    const result = await db.query(query, [hash]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...row,
      resolver_summary: parseJsonb(row.resolver_summary),
      resolution_trace: parseJsonb(row.resolution_trace),
    };
  }
}
