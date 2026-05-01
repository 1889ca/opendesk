/** Contract: contracts/sharing/rules.md */

import { randomUUID } from 'node:crypto';

/**
 * A pending grant represents an invite-by-email that has not yet been
 * activated. It holds a target email address rather than a granteeId.
 * Once the invitee authenticates, the pending grant is activated: its
 * status transitions to 'active' and the granteeId is filled in.
 */
export type PendingGrant = {
  id: string;
  docId: string;
  grantorId: string;
  granteeEmail: string;
  granteeId: string | null;
  role: string;
  /** Status follows the one-directional transition: pending -> active -> revoked */
  status: 'pending' | 'active' | 'revoked';
  createdAt: string;
  activatedAt: string | null;
};

/**
 * Storage interface for pending grants (invite-by-email workflow).
 * Implementations must be swappable (in-memory for tests, PG for prod).
 */
export type PendingGrantStore = {
  createPending(params: {
    docId: string;
    grantorId: string;
    email: string;
    role: string;
  }): Promise<PendingGrant>;

  findPendingByEmail(email: string): Promise<PendingGrant[]>;

  activateGrant(grantId: string, granteeId: string): Promise<PendingGrant>;

  findById(id: string): Promise<PendingGrant | null>;
};

/**
 * In-memory implementation of PendingGrantStore.
 * Suitable for testing and development only.
 */
export function createInMemoryPendingGrantStore(): PendingGrantStore {
  const grants = new Map<string, PendingGrant>();

  return {
    async createPending({ docId, grantorId, email, role }) {
      // Issue #508: canonicalize so stored email always matches activation-time lookup.
      const grant: PendingGrant = {
        id: randomUUID(),
        docId,
        grantorId,
        granteeEmail: email.trim().toLowerCase(),
        granteeId: null,
        role,
        status: 'pending',
        createdAt: new Date().toISOString(),
        activatedAt: null,
      };
      grants.set(grant.id, grant);
      return { ...grant };
    },

    async findPendingByEmail(email) {
      // Issue #508: canonicalize before matching so lookup is case-insensitive.
      const canonical = email.trim().toLowerCase();
      const results: PendingGrant[] = [];
      for (const grant of grants.values()) {
        if (grant.granteeEmail === canonical && grant.status === 'pending') {
          results.push({ ...grant });
        }
      }
      return results;
    },

    async activateGrant(grantId, granteeId) {
      const existing = grants.get(grantId);
      if (!existing) {
        throw new Error(`PendingGrant not found: ${grantId}`);
      }
      if (existing.status !== 'pending') {
        throw new Error(
          `Cannot activate grant ${grantId}: current status is '${existing.status}' (must be 'pending')`,
        );
      }
      const updated: PendingGrant = {
        ...existing,
        granteeId,
        status: 'active',
        activatedAt: new Date().toISOString(),
      };
      grants.set(grantId, updated);
      return { ...updated };
    },

    async findById(id) {
      const grant = grants.get(id);
      return grant ? { ...grant } : null;
    },
  };
}
