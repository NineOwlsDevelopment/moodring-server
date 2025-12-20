import { pool } from "../db";
import { Pool, PoolClient } from "pg";
import { UUID } from "crypto";

type QueryClient = Pool | PoolClient;

export type NotificationType =
  | "market_resolved"
  | "market_expiring"
  | "position_profit"
  | "position_loss"
  | "trade_executed"
  | "comment_reply"
  | "referral_bonus"
  | "withdrawal_completed"
  | "deposit_received";

export interface Notification {
  id: UUID;
  user_id: UUID;
  notification_type: NotificationType;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, any> | null;
  is_read: boolean;
  is_email_sent: boolean;
  created_at: number;
  read_at: number;
}

export interface NotificationCreateInput {
  user_id: UUID;
  notification_type: NotificationType;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, any>;
}

export class NotificationModel {
  static async create(
    data: NotificationCreateInput,
    client?: QueryClient
  ): Promise<Notification> {
    const {
      user_id,
      notification_type,
      title,
      message,
      entity_type = null,
      entity_id = null,
      metadata = null,
    } = data;
    const db = client || pool;
    const now = Math.floor(Date.now() / 1000);

    const query = `
      INSERT INTO notifications (user_id, notification_type, title, message, entity_type, entity_id, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await db.query(query, [
      user_id,
      notification_type,
      title,
      message,
      entity_type,
      entity_id,
      metadata ? JSON.stringify(metadata) : null,
      now,
    ]);
    return result.rows[0];
  }

  static async createMany(
    notifications: NotificationCreateInput[],
    client?: QueryClient
  ): Promise<Notification[]> {
    if (notifications.length === 0) return [];
    const db = client || pool;

    const values: any[] = [];
    const placeholders: string[] = [];

    const now = Math.floor(Date.now() / 1000);
    notifications.forEach((n, index) => {
      const offset = index * 8;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${
          offset + 5
        }, $${offset + 6}, $${offset + 7}, $${offset + 8})`
      );
      values.push(
        n.user_id,
        n.notification_type,
        n.title,
        n.message,
        n.entity_type || null,
        n.entity_id || null,
        n.metadata ? JSON.stringify(n.metadata) : null,
        now
      );
    });

    const query = `
      INSERT INTO notifications (user_id, notification_type, title, message, entity_type, entity_id, metadata, created_at)
      VALUES ${placeholders.join(", ")}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows;
  }

  static async findById(
    id: UUID | string,
    client?: QueryClient
  ): Promise<Notification | null> {
    const db = client || pool;
    const result = await db.query("SELECT * FROM notifications WHERE id = $1", [
      id,
    ]);
    return result.rows[0] || null;
  }

  static async findByUserId(
    userId: UUID | string,
    limit = 50,
    offset = 0,
    unreadOnly = false,
    client?: QueryClient
  ): Promise<{
    notifications: Notification[];
    total: number;
    unreadCount: number;
  }> {
    const db = client || pool;
    const whereClause = unreadOnly
      ? "WHERE user_id = $1 AND is_read = FALSE"
      : "WHERE user_id = $1";

    const [notificationsResult, countResult, unreadResult] = await Promise.all([
      db.query(
        `
        SELECT * FROM notifications
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
        [userId, limit, offset]
      ),
      db.query(
        `SELECT COUNT(*)::int as count FROM notifications ${whereClause}`,
        [userId]
      ),
      db.query(
        "SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND is_read = FALSE",
        [userId]
      ),
    ]);

    return {
      notifications: notificationsResult.rows,
      total: countResult.rows[0]?.count || 0,
      unreadCount: unreadResult.rows[0]?.count || 0,
    };
  }

  static async markAsRead(
    id: UUID | string,
    userId: UUID | string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const result = await db.query(
      `
      UPDATE notifications
      SET is_read = TRUE, read_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `,
      [id, userId]
    );
    return result.rows.length > 0;
  }

  static async markAllAsRead(
    userId: UUID | string,
    client?: QueryClient
  ): Promise<number> {
    const db = client || pool;
    const result = await db.query(
      `
      UPDATE notifications
      SET is_read = TRUE, read_at = EXTRACT(EPOCH FROM NOW())::BIGINT
      WHERE user_id = $1 AND is_read = FALSE
    `,
      [userId]
    );
    return result.rowCount || 0;
  }

  static async getUnreadCount(
    userId: UUID | string,
    client?: QueryClient
  ): Promise<number> {
    const db = client || pool;
    const result = await db.query(
      "SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND is_read = FALSE",
      [userId]
    );
    return result.rows[0]?.count || 0;
  }

  static async markEmailSent(
    id: UUID | string,
    client?: QueryClient
  ): Promise<boolean> {
    const db = client || pool;
    const result = await db.query(
      "UPDATE notifications SET is_email_sent = TRUE WHERE id = $1 RETURNING id",
      [id]
    );
    return result.rows.length > 0;
  }

  static async deleteOld(daysOld = 30, client?: QueryClient): Promise<number> {
    const db = client || pool;
    const result = await db.query(
      "DELETE FROM notifications WHERE created_at < EXTRACT(EPOCH FROM NOW() - INTERVAL '$1 days')::BIGINT AND is_read = TRUE",
      [daysOld]
    );
    return result.rowCount || 0;
  }
}
