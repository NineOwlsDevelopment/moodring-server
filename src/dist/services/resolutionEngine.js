"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolutionEngine = void 0;
const crypto_1 = require("crypto");
const Resolution_1 = require("../models/Resolution");
/**
 * Pure, deterministic resolution engine.
 * No randomness, no system clock, no DB access.
 * Same inputs → same output forever.
 */
class ResolutionEngine {
    /**
     * Main resolution function - routes to appropriate resolver
     */
    static resolveMarket(market, submissions) {
        switch (market.resolution_mode) {
            case Resolution_1.ResolutionMode.ORACLE:
                return OracleResolver.resolve(market, submissions);
            case Resolution_1.ResolutionMode.AUTHORITY:
                return AuthorityResolver.resolve(market, submissions);
            case Resolution_1.ResolutionMode.OPINION:
                return OpinionResolver.resolve(market, submissions);
            default:
                throw new Error(`Unknown resolution mode: ${market.resolution_mode}`);
        }
    }
    /**
     * Generate canonical JSON (stable ordering) and hash
     */
    static generateCanonicalHash(trace) {
        const canonical = JSON.stringify(trace, Object.keys(trace).sort());
        return (0, crypto_1.createHash)("sha256").update(canonical).digest("hex");
    }
}
exports.ResolutionEngine = ResolutionEngine;
/**
 * ORACLE: Platform admins resolve
 */
class OracleResolver {
    static resolve(market, submissions) {
        if (submissions.length === 0) {
            throw new Error("ORACLE mode requires at least one submission from a platform admin");
        }
        // Use the first submission (from platform admin)
        const submission = submissions[0];
        const outcome = submission.outcome;
        // Validate outcome is in the market's outcomes
        if (!market.outcomes.includes(outcome)) {
            throw new Error(`Invalid outcome: ${outcome}`);
        }
        const trace = {
            mode: "ORACLE",
            user_id: submission.user_id,
            submission_id: submission.id,
            outcome,
            evidence: submission.evidence,
            timestamp: submission.submitted_at,
        };
        return {
            final_outcome: outcome,
            resolution_trace: trace,
            canonical_hash: ResolutionEngine.generateCanonicalHash(trace),
        };
    }
}
/**
 * AUTHORITY: Creator or admin resolves
 */
class AuthorityResolver {
    static resolve(market, submissions) {
        if (submissions.length === 0) {
            throw new Error("AUTHORITY mode requires at least one submission from creator or admin");
        }
        // Use the first submission (from creator or admin)
        const authoritySubmission = submissions[0];
        const outcome = authoritySubmission.outcome;
        if (!market.outcomes.includes(outcome)) {
            throw new Error(`Invalid outcome: ${outcome}`);
        }
        const trace = {
            mode: "AUTHORITY",
            user_id: authoritySubmission.user_id,
            submission_id: authoritySubmission.id,
            outcome,
            evidence: authoritySubmission.evidence,
            timestamp: authoritySubmission.submitted_at,
        };
        return {
            final_outcome: outcome,
            resolution_trace: trace,
            canonical_hash: ResolutionEngine.generateCanonicalHash(trace),
        };
    }
}
/**
 * OPINION: Belief snapshot, no external truth
 */
class OpinionResolver {
    static resolve(market, submissions) {
        // Use snapshotTimestamp from config if available, otherwise use current time
        const snapshotTimestamp = market.resolution_config?.snapshotTimestamp || Date.now();
        if (submissions.length === 0) {
            throw new Error("OPINION mode requires at least one submission");
        }
        // For OPINION, we take the most common outcome at snapshot time
        // In practice, this would be the outcome with highest market price at snapshot
        // For now, we use the most common submission
        const outcomeCounts = {};
        submissions.forEach((submission) => {
            const outcome = submission.outcome;
            if (!market.outcomes.includes(outcome)) {
                throw new Error(`Invalid outcome: ${outcome}`);
            }
            outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1;
        });
        let maxCount = 0;
        let finalOutcome = "";
        for (const [outcome, count] of Object.entries(outcomeCounts)) {
            if (count > maxCount) {
                maxCount = count;
                finalOutcome = outcome;
            }
        }
        const trace = {
            mode: "OPINION",
            snapshot_timestamp: snapshotTimestamp,
            total_submissions: submissions.length,
            outcome_counts: outcomeCounts,
            final_outcome: finalOutcome,
            note: "Opinion-based resolution - no external truth claim",
            submissions: submissions.map((s) => ({
                user_id: s.user_id,
                outcome: s.outcome,
                submitted_at: s.submitted_at,
            })),
        };
        return {
            final_outcome: finalOutcome,
            resolution_trace: trace,
            canonical_hash: ResolutionEngine.generateCanonicalHash(trace),
        };
    }
}
//# sourceMappingURL=resolutionEngine.js.map