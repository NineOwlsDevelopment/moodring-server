"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolutionApprovalModel = exports.MarketResolutionModel = exports.ResolutionSubmissionModel = exports.MarketStatus = exports.ResolutionMode = void 0;
const db_1 = require("../db");
const json_1 = require("../utils/json");
var ResolutionMode;
(function (ResolutionMode) {
    ResolutionMode["ORACLE"] = "ORACLE";
    ResolutionMode["AUTHORITY"] = "AUTHORITY";
    ResolutionMode["OPINION"] = "OPINION";
})(ResolutionMode || (exports.ResolutionMode = ResolutionMode = {}));
var MarketStatus;
(function (MarketStatus) {
    MarketStatus["OPEN"] = "OPEN";
    MarketStatus["RESOLVING"] = "RESOLVING";
    MarketStatus["RESOLVED"] = "RESOLVED";
    MarketStatus["DISPUTED"] = "DISPUTED";
})(MarketStatus || (exports.MarketStatus = MarketStatus = {}));
class ResolutionSubmissionModel {
    static async create(data, client) {
        const db = client || db_1.pool;
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
            (0, json_1.prepareJsonb)(data.evidence),
            data.signature || null,
            now,
        ];
        const result = await db.query(query, values);
        return {
            ...result.rows[0],
            evidence: (0, json_1.parseJsonb)(result.rows[0].evidence),
        };
    }
    static async findByMarket(marketId, client) {
        const db = client || db_1.pool;
        const query = `
      SELECT * FROM resolution_submissions
      WHERE market_id = $1
      ORDER BY submitted_at DESC
    `;
        const result = await db.query(query, [marketId]);
        return result.rows.map((row) => ({
            ...row,
            evidence: (0, json_1.parseJsonb)(row.evidence),
        }));
    }
    static async findByUser(userId, marketId, client) {
        const db = client || db_1.pool;
        const query = `
      SELECT * FROM resolution_submissions
      WHERE user_id = $1 AND market_id = $2
      ORDER BY submitted_at DESC
      LIMIT 1
    `;
        const result = await db.query(query, [userId, marketId]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            ...row,
            evidence: (0, json_1.parseJsonb)(row.evidence),
        };
    }
}
exports.ResolutionSubmissionModel = ResolutionSubmissionModel;
class MarketResolutionModel {
    static async create(data, client) {
        const db = client || db_1.pool;
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
            (0, json_1.prepareJsonb)(data.resolver_summary),
            (0, json_1.prepareJsonb)(data.resolution_trace),
            data.canonical_hash,
            now,
        ];
        const result = await db.query(query, values);
        return {
            ...result.rows[0],
            resolver_summary: (0, json_1.parseJsonb)(result.rows[0].resolver_summary),
            resolution_trace: (0, json_1.parseJsonb)(result.rows[0].resolution_trace),
        };
    }
    static async findByMarket(marketId, client) {
        const db = client || db_1.pool;
        const query = "SELECT * FROM market_resolutions WHERE market_id = $1";
        const result = await db.query(query, [marketId]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            ...row,
            resolver_summary: (0, json_1.parseJsonb)(row.resolver_summary),
            resolution_trace: (0, json_1.parseJsonb)(row.resolution_trace),
        };
    }
    static async findByHash(hash, client) {
        const db = client || db_1.pool;
        const query = "SELECT * FROM market_resolutions WHERE canonical_hash = $1";
        const result = await db.query(query, [hash]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            ...row,
            resolver_summary: (0, json_1.parseJsonb)(row.resolver_summary),
            resolution_trace: (0, json_1.parseJsonb)(row.resolution_trace),
        };
    }
}
exports.MarketResolutionModel = MarketResolutionModel;
class ResolutionApprovalModel {
    static async create(data, client) {
        const db = client || db_1.pool;
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
    static async findBySubmission(submissionId, client) {
        const db = client || db_1.pool;
        const query = `
      SELECT * FROM resolution_approvals
      WHERE submission_id = $1
      ORDER BY created_at ASC
    `;
        const result = await db.query(query, [submissionId]);
        return result.rows;
    }
    static async countApprovals(submissionId, client) {
        const db = client || db_1.pool;
        const query = `
      SELECT COUNT(*) as count FROM resolution_approvals
      WHERE submission_id = $1 AND approved = TRUE
    `;
        const result = await db.query(query, [submissionId]);
        return parseInt(result.rows[0]?.count || "0", 10);
    }
    static async hasAdminApproved(submissionId, adminUserId, client) {
        const db = client || db_1.pool;
        const query = `
      SELECT approved FROM resolution_approvals
      WHERE submission_id = $1 AND admin_user_id = $2
      LIMIT 1
    `;
        const result = await db.query(query, [submissionId, adminUserId]);
        return result.rows[0]?.approved === true;
    }
}
exports.ResolutionApprovalModel = ResolutionApprovalModel;
//# sourceMappingURL=Resolution.js.map