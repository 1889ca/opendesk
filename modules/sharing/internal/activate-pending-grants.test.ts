/** Contract: contracts/sharing/rules.md */

import { describe, it, expect } from 'vitest';
import { createInMemoryPendingGrantStore } from './pending-grant-store.ts';
import { activatePendingGrants } from './activate-pending-grants.ts';
import { createPermissions } from '../../permissions/index.ts';

describe('activatePendingGrants', () => {
  it('transitions status to active and sets granteeId on email match', async () => {
    const pendingGrantStore = createInMemoryPendingGrantStore();
    const permissions = createPermissions();
    await permissions.grantStore.create({
      principalId: 'alice',
      resourceId: 'doc-1',
      resourceType: 'document',
      role: 'owner',
      grantedBy: 'alice',
    });

    await pendingGrantStore.createPending({
      docId: 'doc-1',
      grantorId: 'alice',
      email: 'bob@example.com',
      role: 'editor',
    });

    const count = await activatePendingGrants(
      'user-bob',
      'bob@example.com',
      pendingGrantStore,
      permissions.grantStore,
    );

    expect(count).toBe(1);

    const pending = await pendingGrantStore.findPendingByEmail('bob@example.com');
    expect(pending).toHaveLength(0);

    const grants = await permissions.grantStore.findByPrincipalAndResource(
      'user-bob',
      'doc-1',
      'document',
    );
    expect(grants).toHaveLength(1);
    expect(grants[0].role).toBe('editor');
  });

  it('does not activate grants for a different email', async () => {
    const pendingGrantStore = createInMemoryPendingGrantStore();
    const permissions = createPermissions();

    await pendingGrantStore.createPending({
      docId: 'doc-1',
      grantorId: 'alice',
      email: 'bob@example.com',
      role: 'viewer',
    });

    const count = await activatePendingGrants(
      'user-carol',
      'carol@example.com',
      pendingGrantStore,
      permissions.grantStore,
    );

    expect(count).toBe(0);

    const pending = await pendingGrantStore.findPendingByEmail('bob@example.com');
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('pending');
  });

  it('does not auto-activate without calling activatePendingGrants', async () => {
    const pendingGrantStore = createInMemoryPendingGrantStore();

    await pendingGrantStore.createPending({
      docId: 'doc-1',
      grantorId: 'alice',
      email: 'bob@example.com',
      role: 'editor',
    });

    const pending = await pendingGrantStore.findPendingByEmail('bob@example.com');
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('pending');
    expect(pending[0].granteeId).toBeNull();
  });

  it('handles multiple pending grants for the same email', async () => {
    const pendingGrantStore = createInMemoryPendingGrantStore();
    const permissions = createPermissions();

    await pendingGrantStore.createPending({
      docId: 'doc-1',
      grantorId: 'alice',
      email: 'bob@example.com',
      role: 'viewer',
    });
    await pendingGrantStore.createPending({
      docId: 'doc-2',
      grantorId: 'carol',
      email: 'bob@example.com',
      role: 'editor',
    });

    const count = await activatePendingGrants(
      'user-bob',
      'bob@example.com',
      pendingGrantStore,
      permissions.grantStore,
    );

    expect(count).toBe(2);

    const doc1Grants = await permissions.grantStore.findByPrincipalAndResource(
      'user-bob', 'doc-1', 'document',
    );
    const doc2Grants = await permissions.grantStore.findByPrincipalAndResource(
      'user-bob', 'doc-2', 'document',
    );
    expect(doc1Grants).toHaveLength(1);
    expect(doc2Grants).toHaveLength(1);
  });
});
