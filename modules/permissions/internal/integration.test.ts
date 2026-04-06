/** Contract: contracts/permissions/rules.md — Integration tests */
import { describe, it, expect, beforeEach } from 'vitest';
import { createPermissions, type PermissionsModule } from './create-permissions.ts';
import { createInMemoryGrantStore } from './grant-store.ts';
import { evaluate } from '../contract.ts';
import type { Principal } from '../../auth/contract.ts';

const alice: Principal = {
  id: 'alice-1',
  actorType: 'human',
  displayName: 'Alice',
  scopes: [],
};

const bob: Principal = {
  id: 'bob-1',
  actorType: 'human',
  displayName: 'Bob',
  scopes: [],
};

describe('Owner auto-grant on document creation', () => {
  let perms: PermissionsModule;

  beforeEach(() => {
    perms = createPermissions({ grantStore: createInMemoryGrantStore() });
  });

  it('grants owner role to document creator', async () => {
    // Simulate what document-routes.ts does on POST /api/documents
    const docId = 'new-doc-1';
    await perms.grantStore.create({
      principalId: alice.id,
      resourceId: docId,
      resourceType: 'document',
      role: 'owner',
      grantedBy: alice.id,
    });

    const grants = await perms.grantStore.findByPrincipalAndResource(
      alice.id, docId, 'document',
    );
    const result = evaluate(alice, grants, {
      principalId: alice.id,
      action: 'manage',
      resourceId: docId,
      resourceType: 'document',
    });
    expect(result.allowed).toBe(true);
    expect(result.role).toBe('owner');
  });

  it('other users cannot access without a grant', async () => {
    const docId = 'new-doc-2';
    // Alice creates and gets owner grant
    await perms.grantStore.create({
      principalId: alice.id,
      resourceId: docId,
      resourceType: 'document',
      role: 'owner',
      grantedBy: alice.id,
    });

    // Bob has no grant
    const grants = await perms.grantStore.findByPrincipalAndResource(
      bob.id, docId, 'document',
    );
    const result = evaluate(bob, grants, {
      principalId: bob.id,
      action: 'read',
      resourceId: docId,
      resourceType: 'document',
    });
    expect(result.allowed).toBe(false);
  });

  it('shared user with viewer role can read but not write', async () => {
    const docId = 'shared-doc-1';
    await perms.grantStore.create({
      principalId: alice.id,
      resourceId: docId,
      resourceType: 'document',
      role: 'owner',
      grantedBy: alice.id,
    });
    await perms.grantStore.create({
      principalId: bob.id,
      resourceId: docId,
      resourceType: 'document',
      role: 'viewer',
      grantedBy: alice.id,
    });

    const bobGrants = await perms.grantStore.findByPrincipalAndResource(
      bob.id, docId, 'document',
    );

    const readResult = evaluate(bob, bobGrants, {
      principalId: bob.id,
      action: 'read',
      resourceId: docId,
      resourceType: 'document',
    });
    expect(readResult.allowed).toBe(true);

    const writeResult = evaluate(bob, bobGrants, {
      principalId: bob.id,
      action: 'write',
      resourceId: docId,
      resourceType: 'document',
    });
    expect(writeResult.allowed).toBe(false);
  });

  it('revoked grants deny access', async () => {
    const docId = 'revoke-doc-1';
    const grant = await perms.grantStore.create({
      principalId: bob.id,
      resourceId: docId,
      resourceType: 'document',
      role: 'editor',
      grantedBy: alice.id,
    });

    await perms.grantStore.revoke(grant.id);

    const grants = await perms.grantStore.findByPrincipalAndResource(
      bob.id, docId, 'document',
    );
    const result = evaluate(bob, grants, {
      principalId: bob.id,
      action: 'read',
      resourceId: docId,
      resourceType: 'document',
    });
    expect(result.allowed).toBe(false);
  });
});
