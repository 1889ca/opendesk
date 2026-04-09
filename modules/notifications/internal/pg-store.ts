/** Contract: contracts/notifications/rules.md */
import type { Pool } from 'pg';
import type {
  NotificationStore,
  Notification,
  CreateNotification,
} from '../contract.ts';

/** PostgreSQL-backed notification store. */
export function createPgNotificationStore(pool: Pool): NotificationStore {
  async function create(input: CreateNotification): Promise<Notification> {
    const { rows } = await pool.query(
      `INSERT INTO notifications (user_id, type, payload)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, type, payload, read, created_at`,
      [input.user_id, input.type, JSON.stringify(input.payload)],
    );
    return rows[0];
  }

  async function listByUser(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<Notification[]> {
    const { rows } = await pool.query(
      `SELECT id, user_id, type, payload, read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    return rows;
  }

  async function countUnread(userId: string): Promise<number> {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM notifications
       WHERE user_id = $1 AND read = FALSE`,
      [userId],
    );
    return rows[0].count;
  }

  async function markRead(id: string, userId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE notifications SET read = TRUE
       WHERE id = $1 AND user_id = $2 AND read = FALSE`,
      [id, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  async function markAllRead(userId: string): Promise<number> {
    const { rowCount } = await pool.query(
      `UPDATE notifications SET read = TRUE
       WHERE user_id = $1 AND read = FALSE`,
      [userId],
    );
    return rowCount ?? 0;
  }

  async function dismiss(id: string, userId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  return { create, listByUser, countUnread, markRead, markAllRead, dismiss };
}
