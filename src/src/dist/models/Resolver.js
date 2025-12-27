"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolverModel = exports.ResolverRole = exports.ResolverType = void 0;
const db_1 = require("../db");
var ResolverType;
(function (ResolverType) {
    ResolverType["PLATFORM"] = "PLATFORM";
    ResolverType["USER"] = "USER";
    ResolverType["WITNESS"] = "WITNESS";
    ResolverType["CONSENSUS"] = "CONSENSUS";
})(ResolverType || (exports.ResolverType = ResolverType = {}));
var ResolverRole;
(function (ResolverRole) {
    ResolverRole["AUTHORITY"] = "AUTHORITY";
    ResolverRole["WITNESS"] = "WITNESS";
    ResolverRole["JUROR"] = "JUROR";
})(ResolverRole || (exports.ResolverRole = ResolverRole = {}));
class ResolverModel {
    static async findById(id, client) {
        const db = client || db_1.pool;
        const query = "SELECT * FROM resolvers WHERE id = $1";
        const result = await db.query(query, [id]);
        return result.rows[0] || null;
    }
    static async findByType(type, client) {
        const db = client || db_1.pool;
        const query = "SELECT * FROM resolvers WHERE type = $1 ORDER BY reputation_score DESC";
        const result = await db.query(query, [type]);
        return result.rows;
    }
    static async findPlatformResolver(client) {
        const db = client || db_1.pool;
        const query = "SELECT * FROM resolvers WHERE type = $1 LIMIT 1";
        const result = await db.query(query, [ResolverType.PLATFORM]);
        return result.rows[0] || null;
    }
    static async create(data, client) {
        const db = client || db_1.pool;
        const now = Math.floor(Date.now() / 1000);
        const query = `
      INSERT INTO resolvers (type, name, public_key, bond_balance, reputation_score, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
        const values = [
            data.type,
            data.name,
            data.public_key || null,
            data.bond_balance || 0,
            data.reputation_score || 0,
            now,
            now,
        ];
        const result = await db.query(query, values);
        return result.rows[0];
    }
    static async updateBond(id, bondDelta, client) {
        const db = client || db_1.pool;
        const query = `
      UPDATE resolvers
      SET bond_balance = bond_balance + $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $2
      RETURNING *
    `;
        const result = await db.query(query, [bondDelta, id]);
        return result.rows[0] || null;
    }
    static async updateReputation(id, reputationDelta, client) {
        const db = client || db_1.pool;
        const query = `
      UPDATE resolvers
      SET reputation_score = GREATEST(0, reputation_score + $1), updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $2
      RETURNING *
    `;
        const result = await db.query(query, [reputationDelta, id]);
        return result.rows[0] || null;
    }
    static async linkToMarket(marketId, resolverId, role, bondCommitted, client) {
        const db = client || db_1.pool;
        const now = Math.floor(Date.now() / 1000);
        const query = `
      INSERT INTO market_resolvers (market_id, resolver_id, role, bond_committed, created_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (market_id, resolver_id) DO UPDATE
      SET role = EXCLUDED.role, bond_committed = EXCLUDED.bond_committed
      RETURNING *
    `;
        const result = await db.query(query, [
            marketId,
            resolverId,
            role,
            bondCommitted,
            now,
        ]);
        return result.rows[0];
    }
    static async getMarketResolvers(marketId, client) {
        const db = client || db_1.pool;
        const query = `
      SELECT mr.*, r.*
      FROM market_resolvers mr
      INNER JOIN resolvers r ON mr.resolver_id = r.id
      WHERE mr.market_id = $1
    `;
        const result = await db.query(query, [marketId]);
        return result.rows.map((row) => ({
            market_id: row.market_id,
            resolver_id: row.resolver_id,
            role: row.role,
            bond_committed: row.bond_committed,
            created_at: row.created_at,
            resolver: {
                id: row.id,
                type: row.type,
                name: row.name,
                public_key: row.public_key,
                bond_balance: row.bond_balance,
                reputation_score: row.reputation_score,
                created_at: row.created_at,
                updated_at: row.updated_at,
            },
        }));
    }
}
exports.ResolverModel = ResolverModel;
//# sourceMappingURL=Resolver.js.map