/** Contract: contracts/permissions/rules.md */

import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { Grant, GrantDef } from '../contract.ts';
import type { GrantStore } from './grant-store.ts';
import { rlsQuery } from '../../storage/internal/rls-query.ts';

/**
 * PostgreSQL-backed grant store.
 *
 * All queries route through {@link rlsQuery} so the Postgres RLS
 * policies on the `grants` table (migration 011) are actually
 * enforced. The caller must be inside a principal context — either
 * `runWithPrincipal(req.principal.id, ...)` for HTTP requests or
 * `runAsSystem(...)` for background jobs. See issue #126.
 */
export function createPgGrantStore(pool: pg.Pool): GrantStore {
  return {
    async findByPrincipalAndResource(principalId, resourceId, resourceType) {
      const { rows } = await rlsQuery(
        pool,
        `SELECT * FROM grants
         WHERE principal_id = $1 AND resource_id = $2 AND resource_type = $3`,
        [principalId, resourceId, resourceType],
      );
      return rows.map(toGrant);
    },

    async findByResource(resourceId, resourceType) {
      const { rows } = await rlsQuery(
        pool,
        `SELECT * FROM grants WHERE resource_id = $1 AND resource_type = $2`,
        [resourceId, resourceType],
      );
      return rows.map(toGrant);
    },

    async create(def) {
      const id = randomUUID();
      const now = new Date().toISOString();
      await rlsQuery(
        pool,
        `INSERT INTO grants (id, principal_id, resource_id, resource_type, role, granted_by, granted_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, def.principalId, def.resourceId, def.resourceType, def.role, def.grantedBy, now, def.expiresAt ?? null],
      );
      return {
        id,
        principalId: def.principalId,
        resourceId: def.resourceId,
        resourceType: def.resourceType,
        role: def.role,
        grantedBy: def.grantedBy,
        grantedAt: now,
        expiresAt: def.expiresAt,
      };
    },

    async revoke(grantId) {
      const { rowCount } = await rlsQuery(
        pool,
        `DELETE FROM grants WHERE id = $1`,
        [grantId],
      );
      return (rowCount ?? 0) > 0;
    },

    async findById(grantId) {
      const { rows } = await rlsQuery(
        pool,
        `SELECT * FROM grants WHERE id = $1`,
        [grantId],
      );
      return rows.length > 0 ? toGrant(rows[0]) : null;
    },

    async findByPrincipal(principalId) {
      const { rows } = await rlsQuery(
        pool,
        `SELECT * FROM grants WHERE principal_id = $1`,
        [principalId],
      );
      return rows.map(toGrant);
    },

    async deleteByResource(resourceId, resourceType) {
      const { rowCount } = await rlsQuery(
        pool,
        `DELETE FROM grants WHERE resource_id = $1 AND resource_type = $2`,
        [resourceId, resourceType],
      );
      return rowCount ?? 0;
    },
  };
}

function toGrant(row: Record<string, unknown>): Grant {
  return {
    id: String(row.id),
    principalId: String(row.principal_id),
    resourceId: String(row.resource_id),
    resourceType: String(row.resource_type),
    role: String(row.role) as Grant['role'],
    grantedBy: String(row.granted_by),
    grantedAt: String(row.granted_at),
    expiresAt: row.expires_at ? String(row.expires_at) : undefined,
  };
}
