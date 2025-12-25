"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const db_1 = require("../db");
const reservedNames_1 = require("../utils/reservedNames");
class UserModel {
    static async create(data, client) {
        const { username, display_name } = data;
        // Automatically lowercase email
        const email = data.email?.toLowerCase();
        const db = client || db_1.pool;
        // Check for case-insensitive email conflict
        if (email) {
            const emailCheck = await db.query("SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)", [email]);
            if (emailCheck.rows.length > 0) {
                throw new Error("Email already exists");
            }
        }
        // Check for case-insensitive username conflict
        if (username) {
            const usernameCheck = await db.query("SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)", [username]);
            if (usernameCheck.rows.length > 0) {
                throw new Error("Username already exists");
            }
        }
        // Check if display name is reserved
        if (display_name && (0, reservedNames_1.isReservedDisplayName)(display_name)) {
            throw new Error("This display name is reserved and cannot be used. Please choose a different name.");
        }
        try {
            const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
            const result = await db.query("INSERT INTO users (email, username, display_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, username, display_name, created_at, updated_at", [email || null, username || null, display_name || null, now, now]);
            return result.rows[0];
        }
        catch (error) {
            // Handle unique constraint violation for email
            if (error.code === "23505" && error.constraint?.includes("email")) {
                throw new Error("Email already exists");
            }
            if (error.code === "23505" && error.constraint?.includes("username")) {
                throw new Error("Username already exists");
            }
            throw error;
        }
    }
    static async findByEmail(email, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [email]);
        return result.rows[0] || null;
    }
    static async findById(id, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
        return result.rows[0] || null;
    }
    static async findAll(client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM users ORDER BY created_at DESC");
        return result.rows;
    }
    static async update(id, data, client) {
        const { username } = data;
        // Automatically lowercase email
        const email = data.email?.toLowerCase();
        const db = client || db_1.pool;
        // Check for case-insensitive email conflict
        if (email !== undefined) {
            const emailCheck = await db.query("SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND id != $2", [email, id]);
            if (emailCheck.rows.length > 0) {
                throw new Error("Email already exists");
            }
        }
        // Check for case-insensitive username conflict
        if (username !== undefined) {
            const usernameCheck = await db.query("SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND id != $2", [username, id]);
            if (usernameCheck.rows.length > 0) {
                throw new Error("Username already exists");
            }
        }
        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramCount = 1;
        if (email !== undefined) {
            updates.push(`email = $${paramCount}`);
            values.push(email);
            paramCount++;
        }
        if (username !== undefined) {
            updates.push(`username = $${paramCount}`);
            values.push(username);
            paramCount++;
        }
        if (updates.length === 0) {
            throw new Error("No fields to update");
        }
        updates.push(`updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT`);
        values.push(id);
        const query = `
      UPDATE users 
      SET ${updates.join(", ")}
      WHERE id = $${paramCount}
      RETURNING *
    `;
        try {
            const result = await db.query(query, values);
            return result.rows[0] || null;
        }
        catch (error) {
            // Handle unique constraint violation for email
            if (error.code === "23505" && error.constraint?.includes("email")) {
                throw new Error("Email already exists");
            }
            if (error.code === "23505" && error.constraint?.includes("username")) {
                throw new Error("Username already exists");
            }
            throw error;
        }
    }
    static async delete(id, client) {
        const db = client || db_1.pool;
        const result = await db.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
        return result.rows.length > 0;
    }
    static async findByUsername(username, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT * FROM users WHERE LOWER(username) = LOWER($1)", [username]);
        return result.rows[0] || null;
    }
    static async existsByEmail(email, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)", [email]);
        return result.rows.length > 0;
    }
    static async existsByUsername(username, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)", [username]);
        return result.rows.length > 0;
    }
    static async existsById(id, client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT 1 FROM users WHERE id = $1", [id]);
        return result.rows.length > 0;
    }
    static async count(client) {
        const db = client || db_1.pool;
        const result = await db.query("SELECT COUNT(*) FROM users");
        return parseInt(result.rows[0].count);
    }
}
exports.UserModel = UserModel;
//# sourceMappingURL=User.js.map