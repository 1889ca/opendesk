/** Contract: contracts/sharing/rules.md */

import type pg from 'pg';
import type { ShareLink } from '../contract.ts';
import type { ShareLinkStore } from './store.ts';

/**
 * PostgreSQL-backed share link store.
 * Survives server restarts, suitable for production.
 */
export function createPgShareLinkStore(pool: pg.Pool): ShareLinkStore {
  return {
    async save(link) {
      await pool.query(
        `INSERT INTO share_links (token, doc_id, grantor_id, role, expires_at, max_redemptions, redemption_count, revoked, password_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          link.token, link.docId, link.grantorId, link.role,
          link.expiresAt ?? null, link.maxRedemptions ?? null,
          link.redemptionCount, link.revoked,
          link.passwordHash ?? null, link.createdAt,
        ],
      );
    },

    async findByToken(token) {
      const { rows } = await pool.query(
        `SELECT * FROM share_links WHERE token = $1`,
        [token],
      );
      return rows.length > 0 ? toShareLink(rows[0]) : null;
    },

    async update(token, patch) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      let i = 1;

      if (patch.redemptionCount !== undefined) {
        sets.push(`redemption_count = $${i++}`);
        vals.push(patch.redemptionCount);
      }
      if (patch.revoked !== undefined) {
        sets.push(`revoked = $${i++}`);
        vals.push(patch.revoked);
      }
      if (patch.expiresAt !== undefined) {
        sets.push(`expires_at = $${i++}`);
        vals.push(patch.expiresAt);
      }

      if (sets.length === 0) return;
      vals.push(token);
      await pool.query(
        `UPDATE share_links SET ${sets.join(', ')} WHERE token = $${i}`,
        vals,
      );
    },

    async listByDoc(docId) {
      const { rows } = await pool.query(
        `SELECT * FROM share_links WHERE doc_id = $1 ORDER BY created_at DESC`,
        [docId],
      );
      return rows.map(toShareLink);
    },
  };
}

function toShareLink(row: Record<string, unknown>): ShareLink {
  return {
    token: String(row.token),
    docId: String(row.doc_id),
    grantorId: String(row.grantor_id),
    role: String(row.role) as ShareLink['role'],
    expiresAt: row.expires_at ? String(row.expires_at) : undefined,
    maxRedemptions: row.max_redemptions != null ? Number(row.max_redemptions) : undefined,
    redemptionCount: Number(row.redemption_count),
    revoked: Boolean(row.revoked),
    passwordHash: row.password_hash ? String(row.password_hash) : undefined,
    createdAt: String(row.created_at),
  };
}
