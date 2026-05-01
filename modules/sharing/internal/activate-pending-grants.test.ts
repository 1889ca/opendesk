/** Contract: contracts/sharing/rules.md */

import { describe, it, expect, beforeEach } from 'vitest';
import { activatePendingGrants } from './activate-pending-grants.ts';
import { createInMemoryPendingGrantStore, type PendingGrantStore } from './pending-grant-store.ts';
import { createInMemoryGrantStore, type GrantStore } from '../../permissions/index.ts';

// ---------------------------------------------------------------------------
// Helpers (re-exported for use in activate-pending-grants-toctou.test.ts)
// ---------------------------------------------------------------------------

export async function seedGrantorRole(
  grantStore: GrantStore,
  grantorId: string,
  docId: string,
  role: 'owner' | 'editor' | 'commenter' | 'viewer',
) {
  return grantStore.create({
    principalId: grantorId,
    resourceId: docId,
    resourceType: 'document',
    role,
    grantedBy: 'system',
  });
}

export async function seedPendingInvite(
  pendingStore: PendingGrantStore,
  params: { docId: string; grantorId: string; email: string; role: string },
) {
  return pendingStore.createPending(params);
}

// ---------------------------------------------------------------------------
// Issue #508 — emailVerified gate
// ---------------------------------------------------------------------------

describe('activatePendingGrants — Issue #508 email verification', () => {
  let pendingStore: PendingGrantStore;
  let grantStore: GrantStore;

  beforeEach(async () => {
    pendingStore = createInMemoryPendingGrantStore();
    grantStore = createInMemoryGrantStore();
    await seedGrantorRole(grantStore, 'grantor-1', 'doc-1', 'editor');
    await seedPendingInvite(pendingStore, {
      docId: 'doc-1',
      grantorId: 'grantor-1',
      email: 'victim@example.com',
      role: 'viewer',
    });
  });

  it('rejects activation when emailVerified is false', async () => {
    const count = await activatePendingGrants(
      'attacker-id', 'victim@example.com', false, pendingStore, grantStore,
    );
    expect(count).toBe(0);
    const grants = await grantStore.findByPrincipal('attacker-id');
    expect(grants).toHaveLength(0);
  });

  it('activates grants when emailVerified is true', async () => {
    const count = await activatePendingGrants(
      'user-verified', 'victim@example.com', true, pendingStore, grantStore,
    );
    expect(count).toBe(1);
    const grants = await grantStore.findByPrincipal('user-verified');
    expect(grants).toHaveLength(1);
    expect(grants[0].role).toBe('viewer');
    expect(grants[0].resourceId).toBe('doc-1');
  });

  it('canonicalizes email — case-insensitive match', async () => {
    const count = await activatePendingGrants(
      'user-verified', 'Victim@EXAMPLE.COM', true, pendingStore, grantStore,
    );
    expect(count).toBe(1);
    const grants = await grantStore.findByPrincipal('user-verified');
    expect(grants).toHaveLength(1);
  });

  it('canonicalizes email — trims whitespace', async () => {
    const count = await activatePendingGrants(
      'user-verified', '  victim@example.com  ', true, pendingStore, grantStore,
    );
    expect(count).toBe(1);
  });

  it('returns 0 when no pending grants match the verified email', async () => {
    const count = await activatePendingGrants(
      'user-verified', 'nobody@example.com', true, pendingStore, grantStore,
    );
    expect(count).toBe(0);
  });
});
