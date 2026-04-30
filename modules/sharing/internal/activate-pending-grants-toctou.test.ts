/** Contract: contracts/sharing/rules.md */

import { describe, it, expect, beforeEach } from 'vitest';
import { activatePendingGrants } from './activate-pending-grants.ts';
import { createInMemoryPendingGrantStore } from './pending-grant-store.ts';
import { createInMemoryGrantStore } from '../../permissions/index.ts';
import type { PendingGrantStore } from './pending-grant-store.ts';
import type { GrantStore } from '../../permissions/index.ts';
import { seedGrantorRole, seedPendingInvite } from './activate-pending-grants.test.ts';

// ---------------------------------------------------------------------------
// Issue #509 — TOCTOU: grantor role re-check at activation time
// ---------------------------------------------------------------------------

describe('activatePendingGrants — Issue #509 TOCTOU grantor role re-check', () => {
  let pendingStore: PendingGrantStore;
  let grantStore: GrantStore;

  beforeEach(() => {
    pendingStore = createInMemoryPendingGrantStore();
    grantStore = createInMemoryGrantStore();
  });

  it('activates with original role when grantor still holds the same role', async () => {
    await seedGrantorRole(grantStore, 'grantor-1', 'doc-1', 'editor');
    await seedPendingInvite(pendingStore, {
      docId: 'doc-1', grantorId: 'grantor-1', email: 'invitee@example.com', role: 'editor',
    });

    const count = await activatePendingGrants(
      'invitee-id', 'invitee@example.com', true, pendingStore, grantStore,
    );

    expect(count).toBe(1);
    const grants = await grantStore.findByPrincipalAndResource('invitee-id', 'doc-1', 'document');
    expect(grants[0].role).toBe('editor');
  });

  it('clamps role to grantor current role when grantor was demoted after invite', async () => {
    await seedGrantorRole(grantStore, 'grantor-1', 'doc-1', 'editor');
    await seedPendingInvite(pendingStore, {
      docId: 'doc-1', grantorId: 'grantor-1', email: 'invitee@example.com', role: 'editor',
    });

    // Demote grantor: revoke editor, grant only viewer.
    const grantorGrants = await grantStore.findByPrincipalAndResource('grantor-1', 'doc-1', 'document');
    for (const g of grantorGrants) await grantStore.revoke(g.id);
    await seedGrantorRole(grantStore, 'grantor-1', 'doc-1', 'viewer');

    const count = await activatePendingGrants(
      'invitee-id', 'invitee@example.com', true, pendingStore, grantStore,
    );

    expect(count).toBe(1);
    const grants = await grantStore.findByPrincipalAndResource('invitee-id', 'doc-1', 'document');
    expect(grants[0].role).toBe('viewer');
  });

  it('drops the pending grant when grantor is fully revoked', async () => {
    await seedGrantorRole(grantStore, 'grantor-1', 'doc-1', 'editor');
    await seedPendingInvite(pendingStore, {
      docId: 'doc-1', grantorId: 'grantor-1', email: 'invitee@example.com', role: 'editor',
    });

    // Fully revoke grantor.
    const grantorGrants = await grantStore.findByPrincipalAndResource('grantor-1', 'doc-1', 'document');
    for (const g of grantorGrants) await grantStore.revoke(g.id);

    const count = await activatePendingGrants(
      'invitee-id', 'invitee@example.com', true, pendingStore, grantStore,
    );

    expect(count).toBe(0);
    const grants = await grantStore.findByPrincipalAndResource('invitee-id', 'doc-1', 'document');
    expect(grants).toHaveLength(0);
  });

  it('handles multiple grants: drops revoked-grantor, clamps demoted grantor', async () => {
    // doc-2: grantor-a will be fully revoked.
    await seedGrantorRole(grantStore, 'grantor-a', 'doc-2', 'editor');
    await seedPendingInvite(pendingStore, {
      docId: 'doc-2', grantorId: 'grantor-a', email: 'shared@example.com', role: 'editor',
    });

    // doc-3: grantor-b will be demoted to viewer.
    await seedGrantorRole(grantStore, 'grantor-b', 'doc-3', 'editor');
    await seedPendingInvite(pendingStore, {
      docId: 'doc-3', grantorId: 'grantor-b', email: 'shared@example.com', role: 'editor',
    });

    // Fully revoke grantor-a on doc-2.
    const grantsA = await grantStore.findByPrincipalAndResource('grantor-a', 'doc-2', 'document');
    for (const g of grantsA) await grantStore.revoke(g.id);

    // Demote grantor-b on doc-3 to viewer.
    const grantsB = await grantStore.findByPrincipalAndResource('grantor-b', 'doc-3', 'document');
    for (const g of grantsB) await grantStore.revoke(g.id);
    await seedGrantorRole(grantStore, 'grantor-b', 'doc-3', 'viewer');

    const count = await activatePendingGrants(
      'invitee-id', 'shared@example.com', true, pendingStore, grantStore,
    );

    // Only grantor-b grant activates (clamped to viewer); grantor-a is dropped.
    expect(count).toBe(1);

    const doc2Grants = await grantStore.findByPrincipalAndResource('invitee-id', 'doc-2', 'document');
    expect(doc2Grants).toHaveLength(0);

    const doc3Grants = await grantStore.findByPrincipalAndResource('invitee-id', 'doc-3', 'document');
    expect(doc3Grants).toHaveLength(1);
    expect(doc3Grants[0].role).toBe('viewer');
  });
});
