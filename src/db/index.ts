import { Pool, types } from "pg";
import * as dotenv from "dotenv";
import path from "path";

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

export const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
  ssl:
    process.env.DB_SSL === "true"
      ? {
          rejectUnauthorized:
            process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
        }
      : false,
});
