/** Contract: contracts/permissions/rules.md */

import { randomUUID } from 'node:crypto';
import type { Grant, GrantDef } from '../contract.ts';

/**
 * Interface for grant persistence.
 * Implementations must be swappable (in-memory for dev/test, PG for prod).
 */
export type GrantStore = {
  /** Find all grants for a principal on a specific resource. */
  findByPrincipalAndResource(
    principalId: string,
    resourceId: string,
    resourceType: string,
  ): Promise<Grant[]>;

  /** Find all grants for a resource (any principal). */
  findByResource(resourceId: string, resourceType: string): Promise<Grant[]>;

  /** Create a new grant. Returns the persisted grant with generated id/timestamp. */
  create(def: GrantDef): Promise<Grant>;

  /** Revoke (delete) a grant by id. Returns true if found and removed. */
  revoke(grantId: string): Promise<boolean>;

  /** Find a grant by id. */
  findById(grantId: string): Promise<Grant | null>;
};

/**
 * In-memory grant store for development and testing.
 * Not suitable for production — grants are lost on restart.
 */
export function createInMemoryGrantStore(): GrantStore {
  const grants = new Map<string, Grant>();

  return {
    async findByPrincipalAndResource(principalId, resourceId, resourceType) {
      const results: Grant[] = [];
      for (const grant of grants.values()) {
        if (
          grant.principalId === principalId &&
          grant.resourceId === resourceId &&
          grant.resourceType === resourceType
        ) {
          results.push(grant);
        }
      }
      return results;
    },

    async findByResource(resourceId, resourceType) {
      const results: Grant[] = [];
      for (const grant of grants.values()) {
        if (grant.resourceId === resourceId && grant.resourceType === resourceType) {
          results.push(grant);
        }
      }
      return results;
    },

    async create(def) {
      const grant: Grant = {
        id: randomUUID(),
        principalId: def.principalId,
        resourceId: def.resourceId,
        resourceType: def.resourceType,
        role: def.role,
        grantedBy: def.grantedBy,
        grantedAt: new Date().toISOString(),
        expiresAt: def.expiresAt,
      };
      grants.set(grant.id, grant);
      return grant;
    },

    async revoke(grantId) {
      return grants.delete(grantId);
    },

    async findById(grantId) {
      return grants.get(grantId) ?? null;
    },
  };
}
