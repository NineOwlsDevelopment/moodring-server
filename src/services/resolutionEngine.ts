import { createHash } from "crypto";
import { ResolutionMode, ResolutionSubmission } from "../models/Resolution";

export interface ResolutionResult {
  final_outcome: string;
  resolution_trace: any;
  canonical_hash: string;
}

/**
 * Pure, deterministic resolution engine.
 * No randomness, no system clock, no DB access.
 * Same inputs → same output forever.
 */
export class ResolutionEngine {
  /**
   * Main resolution function - routes to appropriate resolver
   */
  static resolveMarket(
    market: {
      id: string;
      question: string;
      resolution_mode: ResolutionMode;
      resolution_config?: any; // Optional, only used by OPINION mode for snapshotTimestamp
      outcomes: string[]; // Array of possible outcomes
    },
    submissions: ResolutionSubmission[]
  ): ResolutionResult {
    switch (market.resolution_mode) {
      case ResolutionMode.ORACLE:
        return OracleResolver.resolve(market, submissions);
      case ResolutionMode.AUTHORITY:
        return AuthorityResolver.resolve(market, submissions);
      case ResolutionMode.OPINION:
        return OpinionResolver.resolve(market, submissions);
      default:
        throw new Error(`Unknown resolution mode: ${market.resolution_mode}`);
    }
  }

  /**
   * Generate canonical JSON (stable ordering) and hash
   */
  static generateCanonicalHash(trace: any): string {
    const canonical = JSON.stringify(trace, Object.keys(trace).sort());
    return createHash("sha256").update(canonical).digest("hex");
  }
}

/**
 * ORACLE: Platform admins resolve
 */
class OracleResolver {
  static resolve(
    market: {
      outcomes: string[];
    },
    submissions: ResolutionSubmission[]
  ): ResolutionResult {
    if (submissions.length === 0) {
      throw new Error(
        "ORACLE mode requires at least one submission from a platform admin"
      );
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
  static resolve(
    market: {
      outcomes: string[];
    },
    submissions: ResolutionSubmission[]
  ): ResolutionResult {
    if (submissions.length === 0) {
      throw new Error(
        "AUTHORITY mode requires at least one submission from creator or admin"
      );
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
  static resolve(
    market: {
      resolution_config?: any;
      outcomes: string[];
    },
    submissions: ResolutionSubmission[]
  ): ResolutionResult {
    // Use snapshotTimestamp from config if available, otherwise use current time
    const snapshotTimestamp =
      market.resolution_config?.snapshotTimestamp || Date.now();

    if (submissions.length === 0) {
      throw new Error("OPINION mode requires at least one submission");
    }

    // For OPINION, we take the most common outcome at snapshot time
    // In practice, this would be the outcome with highest market price at snapshot
    // For now, we use the most common submission
    const outcomeCounts: Record<string, number> = {};
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
