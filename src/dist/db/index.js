"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.initializePool = initializePool;
const pg_1 = require("pg");
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
const secrets_1 = require("../utils/secrets");
dotenv.config({
    path: path_1.default.join(__dirname, "../.env"),
});
// Note: Timestamps are now stored as BIGINT (Unix timestamps in seconds, like Solana)
// BIGINT values are automatically returned as JavaScript numbers by pg, so no special parser needed
// The following parsers are kept for backward compatibility if any TIMESTAMP columns still exist
// Type OIDs: 1114 = TIMESTAMP, 1184 = TIMESTAMPTZ
pg_1.types.setTypeParser(1114, (stringValue) => {
    if (!stringValue)
        return null;
    // Convert TIMESTAMP to Unix timestamp (seconds)
    const isoLike = stringValue.replace(" ", "T");
    const date = new Date(isoLike);
    return Math.floor(date.getTime() / 1000);
});
// TIMESTAMPTZ to Unix timestamp (seconds)
pg_1.types.setTypeParser(1184, (stringValue) => {
    if (!stringValue)
        return null;
    return Math.floor(new Date(stringValue).getTime() / 1000);
});
// Lazy-loaded pool to ensure secrets manager is initialized first
let pool;
let poolInitializationPromise = null;
/**
 * Initialize database pool (must be called after secrets manager is initialized)
 */
async function initializePool() {
    if (pool) {
        return pool;
    }
    if (poolInitializationPromise) {
        return poolInitializationPromise;
    }
    poolInitializationPromise = (async () => {
        const dbHost = await secrets_1.secretsManager.getRequiredSecret("DB_HOST");
        const dbPassword = await secrets_1.secretsManager.getRequiredSecret("DB_PASSWORD");
        exports.pool = pool = new pg_1.Pool({
            user: process.env.DB_USER,
            host: dbHost,
            database: process.env.DB_NAME,
            password: dbPassword,
            port: parseInt(process.env.DB_PORT || "5432"),
            ssl: process.env.DB_SSL === "true"
                ? {
                    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
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
//# sourceMappingURL=index.js.map