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
  submitted_at: number;
}

export interface MarketResolution {
  market_id: UUID;
  final_outcome: string;
  resolution_mode: ResolutionMode;
  resolver_summary: any;
  resolution_trace: any;
  canonical_hash: string;
  resolved_at: number;
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
    const now = Math.floor(Date.now() / 1000);

    const query = `
      INSERT INTO resolution_submissions (market_id, user_id, outcome, evidence, signature, submitted_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      data.market_id,
      data.user_id,
      data.outcome,
      prepareJsonb(data.evidence),
      data.signature || null,
      now,
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
    const now = Math.floor(Date.now() / 1000);
    const query = `
      INSERT INTO market_resolutions (
        market_id, final_outcome, resolution_mode,
        resolver_summary, resolution_trace, canonical_hash, resolved_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      data.market_id,
      data.final_outcome,
      data.resolution_mode,
      prepareJsonb(data.resolver_summary),
      prepareJsonb(data.resolution_trace),
      data.canonical_hash,
      now,
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

/**
 * Resolution Approval Model
 * SECURITY FIX (CVE-001): Multi-admin approval for large market resolutions
 */
export interface ResolutionApproval {
  id: UUID;
  market_id: UUID;
  submission_id: UUID;
  admin_user_id: UUID;
  approved: boolean;
  evidence_hash: string | null;
  approval_signature: string | null;
  created_at: number;
}

export class ResolutionApprovalModel {
  static async create(
    data: {
      market_id: string;
      submission_id: string;
      admin_user_id: string;
      approved: boolean;
      evidence_hash?: string;
      approval_signature?: string;
    },
    client?: QueryClient
  ): Promise<ResolutionApproval> {
    const db = client || pool;
    const now = Math.floor(Date.now() / 1000);

    const query = `
      INSERT INTO resolution_approvals (
        market_id, submission_id, admin_user_id, approved, 
        evidence_hash, approval_signature, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (market_id, submission_id, admin_user_id) 
      DO UPDATE SET 
        approved = EXCLUDED.approved,
        evidence_hash = EXCLUDED.evidence_hash,
        approval_signature = EXCLUDED.approval_signature
      RETURNING *
    `;
    const values = [
      data.market_id,
      data.submission_id,
      data.admin_user_id,
      data.approved,
      data.evidence_hash || null,
      data.approval_signature || null,
      now,
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findBySubmission(
    submissionId: string,
    client?: QueryClient
  ): Promise<ResolutionApproval[]> {
    const db = client || pool;
    const query = `
      SELECT * FROM resolution_approvals
      WHERE submission_id = $1
      ORDER BY created_at ASC
    `;
    const result = await db.query(query, [submissionId]);
    return result.rows;
  }

  static async countApprovals(
    submissionId: string,
    client?: QueryClient
  ): Promise<number> {
    const db = client || pool;
    const query = `
      SELECT COUNT(*) as count FROM resolution_approvals
      WHERE submission_id = $1 AND approved = TRUE
    `;
    const result = await db.query(query, [submissionId]);
    return parseInt(result.rows[0]?.count || "0", 10);
  }

  static async hasAdminApproved(
    submissionId: string,
    adminUserId: string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const query = `
      SELECT approved FROM resolution_approvals
      WHERE submission_id = $1 AND admin_user_id = $2
      LIMIT 1
    `;
    const result = await db.query(query, [submissionId, adminUserId]);
    return result.rows[0]?.approved === true;
  }
}
