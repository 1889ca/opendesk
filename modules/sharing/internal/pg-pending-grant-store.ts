/** Contract: contracts/sharing/rules.md */

import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { PendingGrant, PendingGrantStore } from './pending-grant-store.ts';
import { rlsQuery } from '../../storage/internal/rls-query.ts';

/**
 * PostgreSQL-backed pending grant store.
 *
 * Queries run through {@link rlsQuery} so the caller must be inside a
 * principal context (runWithPrincipal / runAsSystem). See issue #126.
 */
export function createPgPendingGrantStore(pool: pg.Pool): PendingGrantStore {
  return {
    async createPending({ docId, grantorId, email, role }) {
      const id = randomUUID();
      const now = new Date().toISOString();
      await rlsQuery(
        pool,
        `INSERT INTO pending_grants
           (id, doc_id, grantor_id, grantee_email, grantee_id, role, status, created_at, activated_at)
         VALUES ($1, $2, $3, $4, NULL, $5, 'pending', $6, NULL)`,
        [id, docId, grantorId, email, role, now],
      );
      return {
        id,
        docId,
        grantorId,
        granteeEmail: email,
        granteeId: null,
        role,
        status: 'pending' as const,
        createdAt: now,
        activatedAt: null,
      };
    },

    async findPendingByEmail(email) {
      const { rows } = await rlsQuery(
        pool,
        `SELECT * FROM pending_grants WHERE grantee_email = $1 AND status = 'pending'`,
        [email],
      );
      return rows.map(toGrant);
    },

    async activateGrant(grantId, granteeId) {
      const now = new Date().toISOString();
      const { rows } = await rlsQuery(
        pool,
        `UPDATE pending_grants
         SET grantee_id = $2, status = 'active', activated_at = $3
         WHERE id = $1 AND status = 'pending'
         RETURNING *`,
        [grantId, granteeId, now],
      );
      if (rows.length === 0) {
        throw new Error(
          `Cannot activate pending grant ${grantId}: not found or not in 'pending' status`,
        );
      }
      return toGrant(rows[0]);
    },

    async findById(id) {
      const { rows } = await rlsQuery(
        pool,
        `SELECT * FROM pending_grants WHERE id = $1`,
        [id],
      );
      return rows.length > 0 ? toGrant(rows[0]) : null;
    },
  };
}

function toGrant(row: Record<string, unknown>): PendingGrant {
  return {
    id: String(row.id),
    docId: String(row.doc_id),
    grantorId: String(row.grantor_id),
    granteeEmail: String(row.grantee_email),
    granteeId: row.grantee_id != null ? String(row.grantee_id) : null,
    role: String(row.role),
    status: String(row.status) as PendingGrant['status'],
    createdAt: String(row.created_at),
    activatedAt: row.activated_at != null ? String(row.activated_at) : null,
  };
}
