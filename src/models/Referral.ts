import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";

type QueryClient = Pool | PoolClient;

export interface ReferralCode {
  id: UUID;
  user_id: UUID;
  code: string;
  uses_count: number;
  total_earnings: number;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export interface Referral {
  id: UUID;
  referrer_id: UUID;
  referred_id: UUID;
  referral_code_id: UUID;
  referrer_reward: number;
  referred_reward: number;
  is_rewarded: boolean;
  created_at: number;
  rewarded_at: number;
}

export interface ReferralWithDetails extends Referral {
  referred_username?: string;
  referrer_username?: string;
  referral_code?: string;
}

export class ReferralModel {
  /**
   * Generate a unique referral code for a user
   */
  static generateCode(username?: string): string {
    const prefix = username ? username.slice(0, 4).toUpperCase() : "MOOD";
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${random}`;
  }

  /**
   * Create or get a referral code for a user
   */
  static async getOrCreateCode(
    userId: UUID | string,
    client?: QueryClient
  ): Promise<ReferralCode> {
    const db = client || pool;
    // Check if user already has a code
    const existing = await db.query(
      "SELECT * FROM referral_codes WHERE user_id = $1",
      [userId]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Get username for code generation
    const userResult = await db.query(
      "SELECT username FROM users WHERE id = $1",
      [userId]
    );
    const username = userResult.rows[0]?.username;

    // Generate unique code
    let code = this.generateCode(username);
    let attempts = 0;

    const now = Math.floor(Date.now() / 1000);
    while (attempts < 10) {
      try {
        const result = await db.query(
          "INSERT INTO referral_codes (user_id, code, created_at, updated_at) VALUES ($1, $2, $3, $4) RETURNING *",
          [userId, code, now, now]
        );
        return result.rows[0];
      } catch (error: any) {
        if (error.code === "23505") {
          // Unique constraint violation, try new code
          code = this.generateCode(username);
          attempts++;
        } else {
          throw error;
        }
      }
    }

    throw new Error("Failed to generate unique referral code");
  }

  static async findCodeByCode(
    code: string,
    client?: QueryClient
  ): Promise<ReferralCode | null> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM referral_codes WHERE code = $1 AND is_active = TRUE",
      [code.toUpperCase()]
    );
    return result.rows[0] || null;
  }

  static async findCodeByUserId(
    userId: UUID | string,
    client?: QueryClient
  ): Promise<ReferralCode | null> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM referral_codes WHERE user_id = $1",
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Record a referral when a new user signs up with a code
   */
  static async recordReferral(
    referralCodeId: UUID | string,
    referrerId: UUID | string,
    referredId: UUID | string
  ): Promise<Referral> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Insert referral record
      const now = Math.floor(Date.now() / 1000);
      const referralResult = await client.query(
        `
        INSERT INTO referrals (referrer_id, referred_id, referral_code_id, created_at)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
        [referrerId, referredId, referralCodeId, now]
      );

      // Update referral code uses count
      await client.query(
        `
        UPDATE referral_codes
        SET uses_count = uses_count + 1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
        WHERE id = $1
      `,
        [referralCodeId]
      );

      // Link referral code to referred user
      await client.query(
        "UPDATE users SET referral_code_id = $1 WHERE id = $2",
        [referralCodeId, referredId]
      );

      await client.query("COMMIT");
      return referralResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process rewards for a referral (called when conditions are met)
   */
  static async processRewards(
    referralId: UUID | string,
    referrerReward: number,
    referredReward: number
  ): Promise<Referral | null> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Update referral with rewards
      const result = await client.query(
        `
        UPDATE referrals
        SET 
          referrer_reward = $1,
          referred_reward = $2,
          is_rewarded = TRUE,
          rewarded_at = EXTRACT(EPOCH FROM NOW())::BIGINT
        WHERE id = $3 AND is_rewarded = FALSE
        RETURNING *
      `,
        [referrerReward, referredReward, referralId]
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      // Update referral code total earnings
      await client.query(
        `
        UPDATE referral_codes
        SET total_earnings = total_earnings + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
        WHERE id = $2
      `,
        [referrerReward, result.rows[0].referral_code_id]
      );

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async getReferralsByReferrer(
    referrerId: UUID | string,
    limit = 50,
    offset = 0,
    client?: QueryClient
  ): Promise<{ referrals: ReferralWithDetails[]; total: number }> {
    const db = client || pool;
    const [referralsResult, countResult] = await Promise.all([
      db.query(
        `
        SELECT r.*, u.username as referred_username, rc.code as referral_code
        FROM referrals r
        LEFT JOIN users u ON r.referred_id = u.id
        LEFT JOIN referral_codes rc ON r.referral_code_id = rc.id
        WHERE r.referrer_id = $1
        ORDER BY r.created_at DESC
        LIMIT $2 OFFSET $3
      `,
        [referrerId, limit, offset]
      ),
      db.query(
        "SELECT COUNT(*)::int as count FROM referrals WHERE referrer_id = $1",
        [referrerId]
      ),
    ]);

    return {
      referrals: referralsResult.rows,
      total: countResult.rows[0]?.count || 0,
    };
  }

  static async getReferrerStats(
    userId: UUID | string,
    client?: QueryClient
  ): Promise<{
    total_referrals: number;
    total_earnings: number;
    pending_rewards: number;
  }> {
    const db = client || pool;
    const result = await db.query(
      `
      SELECT 
        COUNT(*)::int as total_referrals,
        COALESCE(SUM(referrer_reward) FILTER (WHERE is_rewarded = TRUE), 0)::bigint as total_earnings,
        COUNT(*) FILTER (WHERE is_rewarded = FALSE)::int as pending_rewards
      FROM referrals
      WHERE referrer_id = $1
    `,
      [userId]
    );
    return result.rows[0];
  }

  static async hasBeenReferred(
    userId: UUID | string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const result = await db.query(
      "SELECT 1 FROM referrals WHERE referred_id = $1",
      [userId]
    );
    return result.rows.length > 0;
  }
}
