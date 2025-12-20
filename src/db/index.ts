import { Pool, types } from "pg";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.join(__dirname, "../.env"),
});

// Configure pg to return timestamps as proper ISO strings
// TIMESTAMP columns in PostgreSQL don't have timezone info, so we interpret them
// as NY time (the server's timezone) and convert to ISO format
// Type OIDs: 1114 = TIMESTAMP, 1184 = TIMESTAMPTZ
types.setTypeParser(1114, (stringValue) => {
  // Parse as NY local time and convert to ISO string
  // Format from PostgreSQL: "2025-12-05 15:00:00" or "2025-12-05 15:00:00.123"
  if (!stringValue) return null;

  // Replace space with T to make it ISO-like, then create a Date
  // The server TZ is already set to America/New_York, so Date will interpret correctly
  const isoLike = stringValue.replace(" ", "T");
  const date = new Date(isoLike);

  // Return ISO string which includes timezone info (Z suffix for UTC)
  return date.toISOString();
});

// TIMESTAMPTZ already includes timezone info, just normalize to ISO
types.setTypeParser(1184, (stringValue) => {
  if (!stringValue) return null;
  return new Date(stringValue).toISOString();
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
