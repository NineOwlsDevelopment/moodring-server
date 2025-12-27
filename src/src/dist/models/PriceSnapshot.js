"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceSnapshotModel = void 0;
const db_1 = require("../db");
class PriceSnapshotModel {
    /**
     * Create a new price snapshot (called after each trade)
     */
    static async create(data, client) {
        const db = client || db_1.pool;
        const { option_id, market_id, yes_price, no_price, yes_quantity, no_quantity, volume = 0, trade_count = 1, snapshot_type = "trade", trade_id = null, } = data;
        const now = Math.floor(Date.now() / 1000);
        const query = `
      INSERT INTO price_snapshots (
        option_id, market_id, yes_price, no_price,
        yes_quantity, no_quantity, volume, trade_count,
        snapshot_type, trade_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
        const values = [
            option_id,
            market_id,
            yes_price,
            no_price,
            yes_quantity,
            no_quantity,
            volume,
            trade_count,
            snapshot_type,
            trade_id,
            now,
        ];
        const result = await db.query(query, values);
        return result.rows[0];
    }
    /**
     * Update or create OHLC data for a time bucket
     */
    static async upsertOHLC(data, client) {
        const db = client || db_1.pool;
        const { option_id, market_id, interval_type, price, volume, yes_quantity, no_quantity, } = data;
        // Use PostgreSQL's get_bucket_start function to get the bucket
        const query = `
      INSERT INTO price_ohlc (
        option_id, market_id, interval_type,
        bucket_start, bucket_end,
        open_price, high_price, low_price, close_price,
        volume, trade_count,
        close_yes_quantity, close_no_quantity
      )
      VALUES (
        $1, $2, $3,
        get_bucket_start(EXTRACT(EPOCH FROM NOW())::BIGINT, $3),
        get_bucket_end(get_bucket_start(EXTRACT(EPOCH FROM NOW())::BIGINT, $3), $3),
        $4, $4, $4, $4,
        $5, 1,
        $6, $7
      )
      ON CONFLICT (option_id, interval_type, bucket_start)
      DO UPDATE SET
        high_price = GREATEST(price_ohlc.high_price, EXCLUDED.high_price),
        low_price = LEAST(price_ohlc.low_price, EXCLUDED.low_price),
        close_price = EXCLUDED.close_price,
        volume = price_ohlc.volume + EXCLUDED.volume,
        trade_count = price_ohlc.trade_count + 1,
        close_yes_quantity = EXCLUDED.close_yes_quantity,
        close_no_quantity = EXCLUDED.close_no_quantity,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
    `;
        await db.query(query, [
            option_id,
            market_id,
            interval_type,
            price,
            volume,
            yes_quantity,
            no_quantity,
        ]);
    }
    /**
     * Record a price snapshot and update all OHLC buckets
     * This should be called after every trade
     */
    static async recordPrice(data, client) {
        const db = client || db_1.pool;
        // Create the snapshot
        const snapshot = await this.create(data, db);
        // Update OHLC for all interval types (sequentially to prevent deadlocks)
        const intervals = ["1m", "5m", "15m", "1h", "4h", "1d"];
        for (const interval of intervals) {
            await this.upsertOHLC({
                option_id: data.option_id,
                market_id: data.market_id,
                interval_type: interval,
                price: data.yes_price,
                volume: data.volume || 0,
                yes_quantity: data.yes_quantity,
                no_quantity: data.no_quantity,
            }, db);
        }
        return snapshot;
    }
    /**
     * Get price history for an option within a time range
     */
    static async getHistory(optionId, timeRange, limit = 500, client) {
        const db = client || db_1.pool;
        const cutoffTime = this.getCutoffTime(timeRange);
        const interval = this.getOptimalInterval(timeRange);
        // First try to get OHLC data (more efficient for larger ranges)
        if (interval !== "1m") {
            const ohlcResult = await db.query(`
        SELECT 
          bucket_start * 1000 as timestamp,
          close_price as yes_price,
          1 - close_price as no_price,
          volume
        FROM price_ohlc
        WHERE option_id = $1 
          AND interval_type = $2
          AND bucket_start >= $3
        ORDER BY bucket_start ASC
        LIMIT $4
      `, [optionId, interval, cutoffTime, limit]);
            if (ohlcResult.rows.length > 0) {
                return ohlcResult.rows.map((row) => ({
                    timestamp: Number(row.timestamp),
                    yesPrice: Number(row.yes_price),
                    noPrice: Number(row.no_price),
                    volume: Number(row.volume),
                }));
            }
        }
        // Fall back to raw snapshots if no OHLC data
        const result = await db.query(`
      SELECT 
        created_at * 1000 as timestamp,
        yes_price,
        no_price,
        volume
      FROM price_snapshots
      WHERE option_id = $1 AND created_at >= $2
      ORDER BY created_at ASC
      LIMIT $3
    `, [optionId, cutoffTime, limit]);
        return result.rows.map((row) => ({
            timestamp: Number(row.timestamp),
            yesPrice: Number(row.yes_price),
            noPrice: Number(row.no_price),
            volume: Number(row.volume),
        }));
    }
    /**
     * Get OHLC data for candlestick charts
     */
    static async getOHLC(optionId, interval, timeRange, limit = 200, client) {
        const db = client || db_1.pool;
        const cutoffTime = this.getCutoffTime(timeRange);
        const result = await db.query(`
      SELECT 
        bucket_start * 1000 as timestamp,
        open_price as open,
        high_price as high,
        low_price as low,
        close_price as close,
        volume
      FROM price_ohlc
      WHERE option_id = $1 
        AND interval_type = $2
        AND bucket_start >= $3
      ORDER BY bucket_start ASC
      LIMIT $4
    `, [optionId, interval, cutoffTime, limit]);
        return result.rows.map((row) => ({
            timestamp: Number(row.timestamp),
            open: Number(row.open),
            high: Number(row.high),
            low: Number(row.low),
            close: Number(row.close),
            volume: Number(row.volume),
        }));
    }
    /**
     * Get price history for all options in a market (for multi-choice markets)
     */
    static async getMarketHistory(marketId, timeRange, limit = 500, client) {
        const db = client || db_1.pool;
        const cutoffTime = this.getCutoffTime(timeRange);
        const interval = this.getOptimalInterval(timeRange);
        // Get all options for this market
        const optionsResult = await db.query("SELECT id FROM market_options WHERE market_id = $1", [marketId]);
        const historyMap = new Map();
        // Try OHLC first
        const ohlcResult = await db.query(`
      SELECT 
        option_id,
        bucket_start * 1000 as timestamp,
        close_price as yes_price,
        1 - close_price as no_price,
        volume
      FROM price_ohlc
      WHERE market_id = $1 
        AND interval_type = $2
        AND bucket_start >= $3
      ORDER BY option_id, bucket_start ASC
    `, [marketId, interval, cutoffTime]);
        if (ohlcResult.rows.length > 0) {
            // Group by option_id
            for (const row of ohlcResult.rows) {
                const optionId = row.option_id;
                if (!historyMap.has(optionId)) {
                    historyMap.set(optionId, []);
                }
                historyMap.get(optionId).push({
                    timestamp: Number(row.timestamp),
                    yesPrice: Number(row.yes_price),
                    noPrice: Number(row.no_price),
                    volume: Number(row.volume),
                });
            }
            return historyMap;
        }
        // Fall back to snapshots
        const result = await db.query(`
      SELECT 
        option_id,
        created_at * 1000 as timestamp,
        yes_price,
        no_price,
        volume
      FROM price_snapshots
      WHERE market_id = $1 AND created_at >= $2
      ORDER BY option_id, created_at ASC
    `, [marketId, cutoffTime]);
        for (const row of result.rows) {
            const optionId = row.option_id;
            if (!historyMap.has(optionId)) {
                historyMap.set(optionId, []);
            }
            historyMap.get(optionId).push({
                timestamp: Number(row.timestamp),
                yesPrice: Number(row.yes_price),
                noPrice: Number(row.no_price),
                volume: Number(row.volume),
            });
        }
        return historyMap;
    }
    /**
     * Get the latest price snapshot for an option
     */
    static async getLatest(optionId, client) {
        const db = client || db_1.pool;
        const result = await db.query(`
      SELECT * FROM price_snapshots
      WHERE option_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [optionId]);
        return result.rows[0] || null;
    }
    /**
     * Check if an option has any price history
     */
    static async hasHistory(optionId, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT 1 FROM price_snapshots WHERE option_id = $1 LIMIT 1", [optionId]);
        return result.rows.length > 0;
    }
    /**
     * Get snapshot count for an option (useful for pagination)
     */
    static async getCount(optionId, timeRange, client) {
        const db = client || db_1.pool;
        const cutoffTime = timeRange ? this.getCutoffTime(timeRange) : 0;
        const result = await db.query(`
      SELECT COUNT(*)::int as count 
      FROM price_snapshots 
      WHERE option_id = $1 AND created_at >= $2
    `, [optionId, cutoffTime]);
        return result.rows[0]?.count || 0;
    }
    /**
     * Clean up old snapshots (for maintenance - keep 30 days of raw data)
     * OHLC data is kept indefinitely as it's already aggregated
     */
    static async cleanupOldSnapshots(daysToKeep = 30, client) {
        const db = client || db_1.pool;
        const cutoff = Math.floor(Date.now() / 1000) - daysToKeep * 24 * 60 * 60;
        const result = await db.query(`
      DELETE FROM price_snapshots 
      WHERE created_at < $1
      RETURNING id
    `, [cutoff]);
        return result.rowCount || 0;
    }
    // ============================================
    // HELPER METHODS
    // ============================================
    static getCutoffTime(timeRange) {
        const now = Math.floor(Date.now() / 1000);
        switch (timeRange) {
            case "1H":
                return now - 60 * 60;
            case "24H":
                return now - 24 * 60 * 60;
            case "7D":
                return now - 7 * 24 * 60 * 60;
            case "30D":
                return now - 30 * 24 * 60 * 60;
            case "ALL":
                return 0;
            default:
                return now - 7 * 24 * 60 * 60;
        }
    }
    static getOptimalInterval(timeRange) {
        switch (timeRange) {
            case "1H":
                return "1m";
            case "24H":
                return "5m";
            case "7D":
                return "15m";
            case "30D":
                return "1h";
            case "ALL":
                return "4h";
            default:
                return "15m";
        }
    }
}
exports.PriceSnapshotModel = PriceSnapshotModel;
//# sourceMappingURL=PriceSnapshot.js.map