import { Pool, types } from "pg";
import * as dotenv from "dotenv";
import path from "path";
import { secretsManager } from "../utils/secrets";

dotenv.config({
  path: path.join(__dirname, "../.env"),
});

// Note: Timestamps are now stored as BIGINT (Unix timestamps in seconds, like Solana)
// BIGINT values are automatically returned as JavaScript numbers by pg, so no special parser needed
// The following parsers are kept for backward compatibility if any TIMESTAMP columns still exist
// Type OIDs: 1114 = TIMESTAMP, 1184 = TIMESTAMPTZ
types.setTypeParser(1114, (stringValue) => {
  if (!stringValue) return null;
  // Convert TIMESTAMP to Unix timestamp (seconds)
  const isoLike = stringValue.replace(" ", "T");
  const date = new Date(isoLike);
  return Math.floor(date.getTime() / 1000);
});

// TIMESTAMPTZ to Unix timestamp (seconds)
types.setTypeParser(1184, (stringValue) => {
  if (!stringValue) return null;
  return Math.floor(new Date(stringValue).getTime() / 1000);
});

// Lazy-loaded pool to ensure secrets manager is initialized first
let pool: Pool;
let poolInitializationPromise: Promise<Pool> | null = null;

/**
 * Initialize database pool (must be called after secrets manager is initialized)
 */
export async function initializePool(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  if (poolInitializationPromise) {
    return poolInitializationPromise;
  }

  poolInitializationPromise = (async () => {
    const dbHost = await secretsManager.getRequiredSecret("DB_HOST");
    const dbPassword = await secretsManager.getRequiredSecret("DB_PASSWORD");

    pool = new Pool({
      user: process.env.DB_USER,
      host: dbHost,
      database: process.env.DB_NAME,
      password: dbPassword,
      port: 5432,
      ssl:
        process.env.DB_SSL === "true"
          ? {
              rejectUnauthorized:
                process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
            }
          : false,
      // SECURITY: Set connection pool limits to prevent exhaustion
      max: parseInt(process.env.DB_POOL_MAX || "20", 10), // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
    });

    if (!pool) {
      throw new Error("Failed to initialize database pool");
    }

    return pool;
  })();

  return poolInitializationPromise;
}

// Export pool for backward compatibility
// Note: This will be null until initializePool() is called
// In production, initializePool() should be called at startup after secrets are initialized
export { pool };
