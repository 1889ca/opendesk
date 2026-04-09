/** Contract: contracts/federation/rules.md */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  grantFederatedPermission,
  revokeFederatedPermission,
  checkFederatedPermission,
  createInMemoryPermissionStore,
  RoleCeilingExceededError,
  PermissionAlreadyExistsError,
  type FederatedPermissionStore,
} from './federated-permissions.ts';
import { generateKeyPair } from './signing.ts';

describe('federated-permissions', () => {
  let store: FederatedPermissionStore;
  const { privateKey } = generateKeyPair();

  beforeEach(() => {
    store = createInMemoryPermissionStore();
  });

  it('grants a permission within ceiling', async () => {
    const perm = await grantFederatedPermission(store, 'doc-1', 'peer-1', 'viewer', 'user-1', 'editor');
    expect(perm.documentId).toBe('doc-1');
    expect(perm.role).toBe('viewer');
    expect(perm.peerInstanceId).toBe('peer-1');
  });

  it('grants at exact ceiling', async () => {
    const perm = await grantFederatedPermission(store, 'doc-1', 'peer-1', 'editor', 'user-1', 'editor');
    expect(perm.role).toBe('editor');
  });

  it('rejects role exceeding ceiling', async () => {
    await expect(
      grantFederatedPermission(store, 'doc-1', 'peer-1', 'editor', 'user-1', 'viewer'),
    ).rejects.toThrow(RoleCeilingExceededError);
  });

  it('rejects duplicate permission', async () => {
    await grantFederatedPermission(store, 'doc-1', 'peer-1', 'viewer', 'user-1', 'editor');
    await expect(
      grantFederatedPermission(store, 'doc-1', 'peer-1', 'editor', 'user-1', 'editor'),
    ).rejects.toThrow(PermissionAlreadyExistsError);
  });

  it('checks permission correctly', async () => {
    await grantFederatedPermission(store, 'doc-1', 'peer-1', 'editor', 'user-1', 'editor');
    expect(await checkFederatedPermission(store, 'doc-1', 'peer-1', 'viewer')).toBe(true);
    expect(await checkFederatedPermission(store, 'doc-1', 'peer-1', 'editor')).toBe(true);
    expect(await checkFederatedPermission(store, 'doc-1', 'peer-2', 'viewer')).toBe(false);
  });

  it('revokes a permission and returns signed message', async () => {
    const perm = await grantFederatedPermission(store, 'doc-1', 'peer-1', 'editor', 'user-1', 'editor');
    const msg = await revokeFederatedPermission(store, perm.id, 'local-instance', privateKey);

    expect(msg).not.toBeNull();
    expect(msg!.type).toBe('permission_revoked');
    expect(msg!.toInstanceId).toBe('peer-1');
    expect(msg!.signature).toBeTruthy();

    // After revocation, permission check should fail
    expect(await checkFederatedPermission(store, 'doc-1', 'peer-1', 'viewer')).toBe(false);
  });

  it('returns null when revoking non-existent permission', async () => {
    const msg = await revokeFederatedPermission(store, 'nonexistent-id', 'local', privateKey);
    expect(msg).toBeNull();
  });
});
