import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";

type QueryClient = Pool | PoolClient;

export interface MoodringConfig {
  id: UUID;
  total_markets: number;
  base_mint: string;
  base_decimals: number;
  market_creation_fee: number;
  creator_fees_collected: number;
  protocol_fees_collected: number;
  lifetime_protocol_fees_earned: number;
  current_protocol_fees_balance: number;
  total_protocol_fees_withdrawn: number;
  total_value_locked: number;
  total_volume: number;
  lp_fee_rate: number;
  protocol_fee_rate: number;
  creator_fee_rate: number;
  pause_trading: boolean;
  is_initialized: boolean;

  // Admin Controls
  maintenance_mode: boolean;
  allow_user_registration: boolean;
  allow_market_creation: boolean;
  allow_trading: boolean;
  allow_withdrawals: boolean;
  allow_deposits: boolean;

  // Prediction Market Trading Limits
  min_trade_amount: number;
  max_trade_amount: number;
  max_position_per_market: number;
  max_daily_user_volume: number;

  // Market Creation & Management Controls
  max_markets_per_user: number;
  max_open_markets_per_user: number;
  min_market_duration_hours: number;
  max_market_duration_days: number;
  max_market_options: number;

  // Market Resolution Controls
  auto_resolve_markets: boolean;
  resolution_oracle_enabled: boolean;
  authority_resolution_enabled: boolean;
  opinion_resolution_enabled: boolean;

  // Liquidity & Pool Controls
  min_initial_liquidity: number;

  // Anti-Manipulation & Risk Controls
  max_market_volatility_threshold: number;
  suspicious_trade_threshold: number;
  circuit_breaker_threshold: number;

  // Dispute Resolution
  default_dispute_period_hours: number;
  required_dispute_bond: number;

  // Social & Engagement Features
  enable_copy_trading: boolean;
  enable_social_feed: boolean;
  enable_live_rooms: boolean;
  enable_referrals: boolean;
  enable_notifications: boolean;

  created_at: number;
  updated_at: number;
}

export interface MoodringAdmin {
  id: UUID;
  user_id: string;
  created_at: number;
  updated_at: number;
}

export interface MoodringConfigInput {
  base_mint: string;
  base_decimals?: number;
  market_creation_fee?: number;
  lp_fee_rate?: number;
  protocol_fee_rate?: number;
  creator_fee_rate?: number;
  pause_trading?: boolean;

  // Admin Controls
  maintenance_mode?: boolean;
  allow_user_registration?: boolean;
  allow_market_creation?: boolean;
  allow_trading?: boolean;
  allow_withdrawals?: boolean;
  allow_deposits?: boolean;

  // Trading Limits
  min_trade_amount?: number;
  max_trade_amount?: number;
  max_position_per_market?: number;
  max_daily_user_volume?: number;

  // Market Controls
  max_markets_per_user?: number;
  max_open_markets_per_user?: number;
  min_market_duration_hours?: number;
  max_market_duration_days?: number;
  max_market_options?: number;

  // Resolution Controls
  auto_resolve_markets?: boolean;
  resolution_oracle_enabled?: boolean;
  authority_resolution_enabled?: boolean;
  opinion_resolution_enabled?: boolean;

  // Liquidity Controls
  min_initial_liquidity?: number;

  // Risk Controls
  max_market_volatility_threshold?: number;
  suspicious_trade_threshold?: number;
  circuit_breaker_threshold?: number;

  // Dispute Controls
  default_dispute_period_hours?: number;
  required_dispute_bond?: number;

  // Feature Flags
  enable_copy_trading?: boolean;
  enable_social_feed?: boolean;
  enable_live_rooms?: boolean;
  enable_referrals?: boolean;
  enable_notifications?: boolean;
}

export interface MoodringConfigUpdateInput {
  base_mint?: string;
  base_decimals?: number;
  market_creation_fee?: number;
  lp_fee_rate?: number;
  protocol_fee_rate?: number;
  creator_fee_rate?: number;
  pause_trading?: boolean;

  // Admin Controls
  maintenance_mode?: boolean;
  allow_user_registration?: boolean;
  allow_market_creation?: boolean;
  allow_trading?: boolean;
  allow_withdrawals?: boolean;
  allow_deposits?: boolean;

  // Trading Limits
  min_trade_amount?: number;
  max_trade_amount?: number;
  max_position_per_market?: number;
  max_daily_user_volume?: number;

  // Market Controls
  max_markets_per_user?: number;
  max_open_markets_per_user?: number;
  min_market_duration_hours?: number;
  max_market_duration_days?: number;
  max_market_options?: number;

  // Resolution Controls
  auto_resolve_markets?: boolean;
  resolution_oracle_enabled?: boolean;
  authority_resolution_enabled?: boolean;
  opinion_resolution_enabled?: boolean;

  // Liquidity Controls
  min_initial_liquidity?: number;

  // Risk Controls
  max_market_volatility_threshold?: number;
  suspicious_trade_threshold?: number;
  circuit_breaker_threshold?: number;

  // Dispute Controls
  default_dispute_period_hours?: number;
  required_dispute_bond?: number;

  // Feature Flags
  enable_copy_trading?: boolean;
  enable_social_feed?: boolean;
  enable_live_rooms?: boolean;
  enable_referrals?: boolean;
  enable_notifications?: boolean;
}

export class MoodringModel {
  /**
   * Get the singleton moodring config
   */
  static async get(client?: QueryClient): Promise<MoodringConfig | null> {
    const db = client || pool;
    const result = await db.query("SELECT * FROM moodring LIMIT 1");
    return result.rows[0] || null;
  }

  /**
   * Initialize the moodring config (creates if not exists)
   */
  static async initialize(
    data: MoodringConfigInput,
    client?: QueryClient
  ): Promise<MoodringConfig> {
    const db = client || pool;

    // Check if already initialized
    const existing = await this.get(client);
    if (existing) {
      throw new Error("Moodring config already initialized");
    }

    const query = `
      INSERT INTO moodring (
        base_mint,
        base_decimals,
        market_creation_fee,
        lp_fee_rate,
        protocol_fee_rate,
        creator_fee_rate,
        pause_trading,
        is_initialized,
        maintenance_mode,
        allow_user_registration,
        allow_market_creation,
        allow_trading,
        allow_withdrawals,
        allow_deposits,
        min_trade_amount,
        max_trade_amount,
        max_position_per_market,
        max_daily_user_volume,
        max_markets_per_user,
        max_open_markets_per_user,
        min_market_duration_hours,
        max_market_duration_days,
        max_market_options,
        auto_resolve_markets,
        resolution_oracle_enabled,
        authority_resolution_enabled,
        opinion_resolution_enabled,
        min_initial_liquidity,
        max_market_volatility_threshold,
        suspicious_trade_threshold,
        circuit_breaker_threshold,
        default_dispute_period_hours,
        required_dispute_bond,
        enable_copy_trading,
        enable_social_feed,
        enable_live_rooms,
        enable_referrals,
        enable_notifications
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37)
      RETURNING *
    `;

    const values = [
      data.base_mint,
      data.base_decimals ?? 6, // USDC decimals
      data.market_creation_fee ?? 0,
      data.lp_fee_rate ?? 100, // 1% (100 basis points)
      data.protocol_fee_rate ?? 50, // 0.5% (50 basis points)
      data.creator_fee_rate ?? 50, // 0.5% (50 basis points)
      data.pause_trading ?? false,
      data.maintenance_mode ?? false,
      data.allow_user_registration ?? true,
      data.allow_market_creation ?? true,
      data.allow_trading ?? true,
      data.allow_withdrawals ?? true,
      data.allow_deposits ?? true,
      data.min_trade_amount ?? 1000000, // 1 USDC
      data.max_trade_amount ?? 25000000000, // 25,000 USDC
      data.max_position_per_market ?? 25000000000, // 25,000 USDC
      data.max_daily_user_volume ?? 100000000000, // 100,000 USDC
      data.max_markets_per_user ?? 10,
      data.max_open_markets_per_user ?? 5,
      data.min_market_duration_hours ?? 24,
      data.max_market_duration_days ?? 365,
      data.max_market_options ?? 10,
      data.auto_resolve_markets ?? false,
      data.resolution_oracle_enabled ?? true,
      data.authority_resolution_enabled ?? true,
      data.opinion_resolution_enabled ?? false,
      data.min_initial_liquidity ?? 100000000, // 100 USDC
      data.max_market_volatility_threshold ?? 5000, // 50%
      data.suspicious_trade_threshold ?? 1000000000, // 1,000 USDC
      data.circuit_breaker_threshold ?? 100000000000, // 100,000 USDC
      data.default_dispute_period_hours ?? 2,
      data.required_dispute_bond ?? 100000000, // 100 USDC
      data.enable_copy_trading ?? false,
      data.enable_social_feed ?? false,
      data.enable_live_rooms ?? false,
      data.enable_referrals ?? false,
      data.enable_notifications ?? true,
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update the moodring config
   */
  static async update(
    data: MoodringConfigUpdateInput,
    client?: QueryClient
  ): Promise<MoodringConfig | null> {
    const db = client || pool;

    const existing = await this.get(client);
    if (!existing) {
      throw new Error("Moodring config not initialized");
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fields: (keyof MoodringConfigUpdateInput)[] = [
      "base_mint",
      "base_decimals",
      "market_creation_fee",
      "lp_fee_rate",
      "protocol_fee_rate",
      "creator_fee_rate",
      "pause_trading",
      "maintenance_mode",
      "allow_user_registration",
      "allow_market_creation",
      "allow_trading",
      "allow_withdrawals",
      "allow_deposits",
      "min_trade_amount",
      "max_trade_amount",
      "max_position_per_market",
      "max_daily_user_volume",
      "max_markets_per_user",
      "max_open_markets_per_user",
      "min_market_duration_hours",
      "max_market_duration_days",
      "max_market_options",
      "auto_resolve_markets",
      "resolution_oracle_enabled",
      "authority_resolution_enabled",
      "opinion_resolution_enabled",
      "min_initial_liquidity",
      "max_market_volatility_threshold",
      "suspicious_trade_threshold",
      "circuit_breaker_threshold",
      "default_dispute_period_hours",
      "required_dispute_bond",
      "enable_copy_trading",
      "enable_social_feed",
      "enable_live_rooms",
      "enable_referrals",
      "enable_notifications",
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex}`);
        values.push(data[field]);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return existing;
    }

    setClauses.push("updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT");
    values.push(existing.id);

    const query = `
      UPDATE moodring
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Increment total_markets counter
   */
  static async incrementTotalMarkets(
    client?: QueryClient
  ): Promise<MoodringConfig | null> {
    const db = client || pool;
    const result = await db.query(`
      UPDATE moodring
      SET total_markets = total_markets + 1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      RETURNING *
    `);
    return result.rows[0] || null;
  }

  /**
   * Update fee collection stats
   */
  static async recordFees(
    creatorFees: number,
    protocolFees: number,
    client?: QueryClient
  ): Promise<MoodringConfig | null> {
    const db = client || pool;
    const result = await db.query(
      `
      UPDATE moodring
      SET 
        creator_fees_collected = creator_fees_collected + $1,
        protocol_fees_collected = protocol_fees_collected + $2,
        lifetime_protocol_fees_earned = lifetime_protocol_fees_earned + $2,
        current_protocol_fees_balance = current_protocol_fees_balance + $2,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      RETURNING *
    `,
      [creatorFees, protocolFees]
    );
    return result.rows[0] || null;
  }

  /**
   * Record protocol fee withdrawal
   * Deducts from current balance but keeps lifetime total
   */
  static async recordProtocolFeeWithdrawal(
    amount: number,
    client?: QueryClient
  ): Promise<MoodringConfig | null> {
    const db = client || pool;
    const result = await db.query(
      `
      UPDATE moodring
      SET 
        current_protocol_fees_balance = GREATEST(0, current_protocol_fees_balance - $1),
        total_protocol_fees_withdrawn = total_protocol_fees_withdrawn + $1,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      RETURNING *
    `,
      [amount]
    );
    return result.rows[0] || null;
  }

  /**
   * Update TVL and volume stats
   */
  static async updateStats(
    tvlDelta: number,
    volumeDelta: number,
    client?: QueryClient
  ): Promise<MoodringConfig | null> {
    const db = client || pool;
    const result = await db.query(
      `
      UPDATE moodring
      SET 
        total_value_locked = total_value_locked + $1,
        total_volume = total_volume + $2,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      RETURNING *
    `,
      [tvlDelta, volumeDelta]
    );
    return result.rows[0] || null;
  }

  /**
   * Set pause trading state
   */
  static async setPauseTrading(
    pauseTrading: boolean,
    client?: QueryClient
  ): Promise<MoodringConfig | null> {
    return this.update({ pause_trading: pauseTrading }, client);
  }

  /**
   * Set maintenance mode
   */
  static async setMaintenanceMode(
    maintenanceMode: boolean,
    client?: QueryClient
  ): Promise<MoodringConfig | null> {
    return this.update({ maintenance_mode: maintenanceMode }, client);
  }

  /**
   * Get admin controls settings
   */
  static async getAdminControls(client?: QueryClient): Promise<{
    maintenance_mode: boolean;
    allow_user_registration: boolean;
    allow_market_creation: boolean;
    allow_trading: boolean;
    allow_withdrawals: boolean;
    allow_deposits: boolean;
  } | null> {
    const db = client || pool;
    const result = await db.query(`
      SELECT
        maintenance_mode,
        allow_user_registration,
        allow_market_creation,
        allow_trading,
        allow_withdrawals,
        allow_deposits
      FROM moodring
      LIMIT 1
    `);
    return result.rows[0] || null;
  }

  /**
   * Get trading limits
   */
  static async getTradingLimits(client?: QueryClient): Promise<{
    min_trade_amount: number;
    max_trade_amount: number;
    max_position_per_market: number;
    max_daily_user_volume: number;
  } | null> {
    const db = client || pool;
    const result = await db.query(`
      SELECT
        min_trade_amount,
        max_trade_amount,
        max_position_per_market,
        max_daily_user_volume
      FROM moodring
      LIMIT 1
    `);
    return result.rows[0] || null;
  }

  /**
   * Get market controls
   */
  static async getMarketControls(client?: QueryClient): Promise<{
    max_markets_per_user: number;
    max_open_markets_per_user: number;
    min_market_duration_hours: number;
    max_market_duration_days: number;
    max_market_options: number;
  } | null> {
    const db = client || pool;
    const result = await db.query(`
      SELECT
        max_markets_per_user,
        max_open_markets_per_user,
        min_market_duration_hours,
        max_market_duration_days,
        max_market_options
      FROM moodring
      LIMIT 1
    `);
    return result.rows[0] || null;
  }

  /**
   * Get resolution controls
   */
  static async getResolutionControls(client?: QueryClient): Promise<{
    auto_resolve_markets: boolean;
    resolution_oracle_enabled: boolean;
    authority_resolution_enabled: boolean;
    opinion_resolution_enabled: boolean;
  } | null> {
    const db = client || pool;
    const result = await db.query(`
      SELECT
        auto_resolve_markets,
        resolution_oracle_enabled,
        authority_resolution_enabled,
        opinion_resolution_enabled
      FROM moodring
      LIMIT 1
    `);
    return result.rows[0] || null;
  }

  /**
   * Get risk controls
   */
  static async getRiskControls(client?: QueryClient): Promise<{
    max_market_volatility_threshold: number;
    suspicious_trade_threshold: number;
    circuit_breaker_threshold: number;
  } | null> {
    const db = client || pool;
    const result = await db.query(`
      SELECT
        max_market_volatility_threshold,
        suspicious_trade_threshold,
        circuit_breaker_threshold
      FROM moodring
      LIMIT 1
    `);
    return result.rows[0] || null;
  }

  /**
   * Get dispute controls
   */
  static async getDisputeControls(client?: QueryClient): Promise<{
    default_dispute_period_hours: number;
    required_dispute_bond: number;
  } | null> {
    const db = client || pool;
    const result = await db.query(`
      SELECT
        default_dispute_period_hours,
        required_dispute_bond
      FROM moodring
      LIMIT 1
    `);
    return result.rows[0] || null;
  }

  /**
   * Get feature flags
   */
  static async getFeatureFlags(client?: QueryClient): Promise<{
    enable_copy_trading: boolean;
    enable_social_feed: boolean;
    enable_live_rooms: boolean;
    enable_referrals: boolean;
    enable_notifications: boolean;
  } | null> {
    const db = client || pool;
    const result = await db.query(`
      SELECT
        enable_copy_trading,
        enable_social_feed,
        enable_live_rooms,
        enable_referrals,
        enable_notifications
      FROM moodring
      LIMIT 1
    `);
    return result.rows[0] || null;
  }

  /**
   * Check if a specific feature is enabled
   */
  static async isFeatureEnabled(
    feature: keyof {
      copy_trading: boolean;
      social_feed: boolean;
      live_rooms: boolean;
      referrals: boolean;
      notifications: boolean;
    },
    client?: QueryClient
  ): Promise<boolean> {
    const featureMap = {
      copy_trading: "enable_copy_trading",
      social_feed: "enable_social_feed",
      live_rooms: "enable_live_rooms",
      referrals: "enable_referrals",
      notifications: "enable_notifications",
    };

    const db = client || pool;
    const result = await db.query(
      `SELECT ${featureMap[feature]} FROM moodring LIMIT 1`
    );
    return result.rows[0]?.[featureMap[feature]] || false;
  }

  /**
   * Check if platform allows a specific action
   */
  static async isActionAllowed(
    action: keyof {
      user_registration: boolean;
      market_creation: boolean;
      trading: boolean;
      withdrawals: boolean;
      deposits: boolean;
    },
    client?: QueryClient
  ): Promise<boolean> {
    const actionMap = {
      user_registration: "allow_user_registration",
      market_creation: "allow_market_creation",
      trading: "allow_trading",
      withdrawals: "allow_withdrawals",
      deposits: "allow_deposits",
    };

    const db = client || pool;
    const result = await db.query(
      `SELECT ${actionMap[action]} FROM moodring LIMIT 1`
    );
    return result.rows[0]?.[actionMap[action]] || false;
  }
}

/**
 * Model for managing moodring admins (separate table)
 */
export class MoodringAdminModel {
  /**
   * Get all admins
   */
  static async getAll(client?: QueryClient): Promise<MoodringAdmin[]> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM moodring_admins ORDER BY created_at ASC"
    );
    return result.rows;
  }

  /**
   * Get all admin user IDs
   */
  static async getAdminUserIds(client?: QueryClient): Promise<string[]> {
    const db = client || pool;
    const result = await db.query("SELECT user_id FROM moodring_admins");
    return result.rows.map((r) => r.user_id);
  }

  /**
   * Check if a user is an admin
   */
  static async isAdmin(userId: string, client?: QueryClient): Promise<boolean> {
    const db = client || pool;
    const result = await db.query(
      "SELECT 1 FROM moodring_admins WHERE user_id = $1 LIMIT 1",
      [userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Add an admin
   */
  static async addAdmin(
    userId: string,
    client?: QueryClient
  ): Promise<MoodringAdmin | null> {
    const db = client || pool;

    // Check if already admin
    const existing = await db.query(
      "SELECT * FROM moodring_admins WHERE user_id = $1",
      [userId]
    );
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    const result = await db.query(
      "INSERT INTO moodring_admins (user_id) VALUES ($1) RETURNING *",
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Remove an admin
   */
  static async removeAdmin(
    userId: string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const result = await db.query(
      "DELETE FROM moodring_admins WHERE user_id = $1 RETURNING id",
      [userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Get admin by user ID with user details
   */
  static async getAdminWithUser(
    userId: string,
    client?: QueryClient
  ): Promise<(MoodringAdmin & { username: string; email: string }) | null> {
    const db = client || pool;
    const result = await db.query(
      `
      SELECT ma.*, u.username, u.email
      FROM moodring_admins ma
      JOIN users u ON ma.user_id = u.id
      WHERE ma.user_id = $1
    `,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all admins with user details
   */
  static async getAllWithUsers(
    client?: QueryClient
  ): Promise<(MoodringAdmin & { username: string; email: string })[]> {
    const db = client || pool;
    const result = await db.query(`
      SELECT ma.*, u.username, u.email
      FROM moodring_admins ma
      JOIN users u ON ma.user_id = u.id
      ORDER BY ma.created_at ASC
    `);
    return result.rows;
  }
}
