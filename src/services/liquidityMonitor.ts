import { pool } from "../db";
import { PoolClient } from "pg";

export interface LiquidityAlert {
  id: string;
  market_id: string;
  alert_type: "low_liquidity" | "insolvency_risk" | "circuit_breaker";
  current_liquidity: number;
  required_liquidity: number;
  reserve_ratio: number;
  severity: "warning" | "critical";
  is_resolved: boolean;
}

/**
 * LiquidityMonitorService monitors shared pool liquidity and alerts on risks
 */
class LiquidityMonitorService {
  private readonly MIN_RESERVE_RATIO = 1.1; // 110% - minimum liquidity reserve
  private readonly WARNING_RESERVE_RATIO = 1.2; // 120% - warning threshold
  private readonly CRITICAL_RESERVE_RATIO = 1.05; // 105% - critical threshold

  /**
   * Check market liquidity and create alerts if needed
   * @param marketId - Market ID to check
   * @param client - Optional database client
   */
  async checkMarketLiquidity(
    marketId: string,
    client?: PoolClient
  ): Promise<LiquidityAlert[]> {
    const db = client || pool;

    // Get market with all options and positions
    const marketResult = await db.query(
      `
      SELECT 
        m.id,
        m.shared_pool_liquidity,
        m.liquidity_parameter,
        COALESCE(SUM(
          CASE 
            WHEN o.winning_side = 1 THEN up.yes_shares
            WHEN o.winning_side = 2 THEN up.no_shares
            ELSE 0
          END
        ), 0)::bigint as total_winning_shares,
        COALESCE(SUM(
          CASE 
            WHEN o.is_resolved = FALSE THEN 
              GREATEST(up.yes_shares, up.no_shares)
            ELSE 0
          END
        ), 0)::bigint as max_potential_payout
      FROM markets m
      LEFT JOIN market_options o ON o.market_id = m.id
      LEFT JOIN user_positions up ON up.option_id = o.id
      WHERE m.id = $1
      GROUP BY m.id, m.shared_pool_liquidity, m.liquidity_parameter
    `,
      [marketId]
    );

    if (marketResult.rows.length === 0) {
      return [];
    }

    const market = marketResult.rows[0];
    const currentLiquidity = Number(market.shared_pool_liquidity || 0);
    const maxPotentialPayout = Number(market.max_potential_payout || 0);
    const totalWinningShares = Number(market.total_winning_shares || 0);

    // Calculate required liquidity (max of resolved payouts or potential payouts)
    const requiredLiquidity = Math.max(
      totalWinningShares, // Already resolved positions
      maxPotentialPayout // Worst-case scenario if all positions win
    );

    const reserveRatio =
      requiredLiquidity > 0 ? currentLiquidity / requiredLiquidity : 100;

    const alerts: LiquidityAlert[] = [];

    // Check for critical insolvency risk
    if (reserveRatio < this.CRITICAL_RESERVE_RATIO) {
      alerts.push({
        id: "",
        market_id: marketId,
        alert_type: "insolvency_risk",
        current_liquidity: currentLiquidity,
        required_liquidity: requiredLiquidity,
        reserve_ratio: reserveRatio * 100,
        severity: "critical",
        is_resolved: false,
      });
    }
    // Check for low liquidity warning
    else if (reserveRatio < this.WARNING_RESERVE_RATIO) {
      alerts.push({
        id: "",
        market_id: marketId,
        alert_type: "low_liquidity",
        current_liquidity: currentLiquidity,
        required_liquidity: requiredLiquidity,
        reserve_ratio: reserveRatio * 100,
        severity: "warning",
        is_resolved: false,
      });
    }

    // Save alerts to database
    for (const alert of alerts) {
      await this.createAlert(alert, db);
    }

    return alerts;
  }

  /**
   * Create a liquidity alert in the database
   */
  private async createAlert(
    alert: Omit<LiquidityAlert, "id">,
    client: PoolClient | typeof pool
  ): Promise<void> {
    // Check if unresolved alert already exists
    const existing = await client.query(
      `
      SELECT id FROM liquidity_alerts
      WHERE market_id = $1 
        AND alert_type = $2 
        AND is_resolved = FALSE
      LIMIT 1
    `,
      [alert.market_id, alert.alert_type]
    );

    if (existing.rows.length > 0) {
      // Update existing alert
      await client.query(
        `
        UPDATE liquidity_alerts
        SET 
          current_liquidity = $1,
          required_liquidity = $2,
          reserve_ratio = $3,
          severity = $4,
          updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
        WHERE id = $5
      `,
        [
          alert.current_liquidity,
          alert.required_liquidity,
          alert.reserve_ratio,
          alert.severity,
          existing.rows[0].id,
        ]
      );
    } else {
      // Create new alert
      await client.query(
        `
        INSERT INTO liquidity_alerts (
          market_id, alert_type, current_liquidity, required_liquidity,
          reserve_ratio, severity
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          alert.market_id,
          alert.alert_type,
          alert.current_liquidity,
          alert.required_liquidity,
          alert.reserve_ratio,
          alert.severity,
        ]
      );
    }
  }

  /**
   * Check all markets for liquidity issues
   */
  async checkAllMarkets(): Promise<number> {
    const result = await pool.query(
      `SELECT id FROM markets WHERE is_resolved = FALSE AND is_initialized = TRUE`
    );

    let totalAlerts = 0;
    for (const market of result.rows) {
      const alerts = await this.checkMarketLiquidity(market.id);
      totalAlerts += alerts.length;
    }

    return totalAlerts;
  }

  /**
   * Get unresolved alerts for a market
   */
  async getUnresolvedAlerts(marketId: string): Promise<LiquidityAlert[]> {
    const result = await pool.query(
      `
      SELECT * FROM liquidity_alerts
      WHERE market_id = $1 AND is_resolved = FALSE
      ORDER BY severity DESC, created_at DESC
    `,
      [marketId]
    );

    return result.rows;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string): Promise<boolean> {
    const result = await pool.query(
      `
      UPDATE liquidity_alerts
      SET 
        is_resolved = TRUE,
        resolved_at = EXTRACT(EPOCH FROM NOW())::BIGINT,
        resolved_by = $1,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $2 AND is_resolved = FALSE
      RETURNING id
    `,
      [resolvedBy, alertId]
    );

    return result.rows.length > 0;
  }
}

// Singleton instance
const liquidityMonitorService = new LiquidityMonitorService();

export const getLiquidityMonitor = (): LiquidityMonitorService => {
  return liquidityMonitorService;
};

export { LiquidityMonitorService };
export default liquidityMonitorService;
