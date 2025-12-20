import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";
import { isReservedDisplayName } from "../utils/reservedNames";

type QueryClient = Pool | PoolClient;

export interface User {
  id: UUID;
  email?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  created_at: Date;
  updated_at: Date;
  isAdmin?: boolean;
}

export interface UserCreateInput {
  email?: string;
  username?: string;
  display_name?: string;
}

export interface UserUpdateInput {
  email?: string;
  username?: string;
  display_name?: string;
}

export class UserModel {
  static async create(
    data: UserCreateInput,
    client?: QueryClient
  ): Promise<User> {
    const { username, display_name } = data;
    // Automatically lowercase email
    const email = data.email?.toLowerCase();
    const db = client || pool;

    // Check for case-insensitive email conflict
    if (email) {
      const emailCheck = await db.query(
        "SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)",
        [email]
      );
      if (emailCheck.rows.length > 0) {
        throw new Error("Email already exists");
      }
    }

    // Check for case-insensitive username conflict
    if (username) {
      const usernameCheck = await db.query(
        "SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)",
        [username]
      );
      if (usernameCheck.rows.length > 0) {
        throw new Error("Username already exists");
      }
    }

    // Check if display name is reserved
    if (display_name && isReservedDisplayName(display_name)) {
      throw new Error(
        "This display name is reserved and cannot be used. Please choose a different name."
      );
    }

    try {
      const result = await db.query(
        "INSERT INTO users (email, username, display_name) VALUES ($1, $2, $3) RETURNING *",
        [email || null, username || null, display_name || null]
      );

      return result.rows[0];
    } catch (error: any) {
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

  static async findByEmail(
    email: string,
    client?: QueryClient
  ): Promise<User | null> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    return result.rows[0] || null;
  }

  static async findById(
    id: number | string,
    client?: QueryClient
  ): Promise<User | null> {
    const db = client || pool;
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);

    return result.rows[0] || null;
  }

  static async findAll(client?: QueryClient): Promise<User[]> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM users ORDER BY created_at DESC"
    );

    return result.rows;
  }

  static async update(
    id: number | string,
    data: UserUpdateInput,
    client?: QueryClient
  ): Promise<User | null> {
    const { username } = data;
    // Automatically lowercase email
    const email = data.email?.toLowerCase();
    const db = client || pool;

    // Check for case-insensitive email conflict
    if (email !== undefined) {
      const emailCheck = await db.query(
        "SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND id != $2",
        [email, id]
      );
      if (emailCheck.rows.length > 0) {
        throw new Error("Email already exists");
      }
    }

    // Check for case-insensitive username conflict
    if (username !== undefined) {
      const usernameCheck = await db.query(
        "SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND id != $2",
        [username, id]
      );
      if (usernameCheck.rows.length > 0) {
        throw new Error("Username already exists");
      }
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
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

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
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
    } catch (error: any) {
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

  static async delete(
    id: number | string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const result = await db.query(
      "DELETE FROM users WHERE id = $1 RETURNING id",
      [id]
    );

    return result.rows.length > 0;
  }

  static async findByUsername(
    username: string,
    client?: QueryClient
  ): Promise<User | null> {
    const db = client || pool;
    const result = await db.query(
      "SELECT * FROM users WHERE LOWER(username) = LOWER($1)",
      [username]
    );

    return result.rows[0] || null;
  }

  static async existsByEmail(
    email: string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const result = await db.query(
      "SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    return result.rows.length > 0;
  }

  static async existsByUsername(
    username: string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const result = await db.query(
      "SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)",
      [username]
    );

    return result.rows.length > 0;
  }

  static async existsById(
    id: number | string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const result = await db.query("SELECT 1 FROM users WHERE id = $1", [id]);

    return result.rows.length > 0;
  }

  static async count(client?: QueryClient): Promise<number> {
    const db = client || pool;
    const result = await db.query("SELECT COUNT(*) FROM users");
    return parseInt(result.rows[0].count);
  }
}
