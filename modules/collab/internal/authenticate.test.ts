/** Contract: contracts/collab/rules.md */
import { describe, it, expect } from 'vitest';
import { createOnAuthenticate } from './authenticate.ts';
import type { TokenVerifier, VerificationResult, Principal } from '../../auth/contract.ts';
import {
  createPermissions,
  createInMemoryGrantStore,
  type PermissionsModule,
  type GrantStore,
  type Role,
} from '../../permissions/index.ts';

const DOC_OPEN = 'doc-open';

/**
 * Real dev-style token verifier — no mocks.
 *
 * - `dev` and `valid:<name>` resolve to principals
 * - any other token rejects
 */
function createTestVerifier(): TokenVerifier {
  return {
    async verifyToken(token: string): Promise<VerificationResult> {
      if (token === 'dev') {
        return {
          ok: true,
          principal: {
            id: 'dev-user',
            actorType: 'human',
            displayName: 'Dev User',
            email: 'dev@opendesk.local',
            scopes: ['*'],
          },
        };
      }

      if (token.startsWith('valid:')) {
        const name = token.slice(6);
        return {
          ok: true,
          principal: {
            id: `user-${name}`,
            actorType: 'human',
            displayName: name,
            email: `${name}@opendesk.local`,
            scopes: ['*'],
          },
        };
      }

      return {
        ok: false,
        error: { code: 'TOKEN_INVALID', message: 'Invalid token' },
      };
    },
  };
}

/**
 * Build a real permissions module backed by an in-memory grant store
 * (no mocks). Pre-seeds an "open" document `doc-open` that everyone
 * can read+write so existing happy-path tests stay readable.
 */
async function createTestPermissions(): Promise<{
  permissions: PermissionsModule;
  grantStore: GrantStore;
  grant: (principalId: string, resourceId: string, role: Role) => Promise<void>;
}> {
  const grantStore = createInMemoryGrantStore();
  const permissions = createPermissions({ grantStore, authMode: 'oidc' });

  const grant = async (principalId: string, resourceId: string, role: Role) => {
    await grantStore.create({
      principalId,
      resourceId,
      resourceType: 'document',
      role,
      grantedBy: 'test-suite',
    });
  };

  // Open dev/happy-path doc — every test principal we spin up gets owner.
  await grant('dev-user', DOC_OPEN, 'owner');
  await grant('user-Alice', DOC_OPEN, 'owner');
  await grant('user-DataUser', DOC_OPEN, 'owner');
  await grant('user-QueryUser', DOC_OPEN, 'owner');

  return { permissions, grantStore, grant };
}

function makeAuthData(overrides: Partial<{
  token: string;
  documentName: string;
  requestParameters: URLSearchParams;
}> = {}) {
  return {
    token: overrides.token ?? '',
    documentName: overrides.documentName ?? DOC_OPEN,
    connection: { readOnly: false },
    requestHeaders: {},
    requestParameters: overrides.requestParameters ?? new URLSearchParams(),
  } as unknown as Parameters<ReturnType<typeof createOnAuthenticate>>[0];
}

describe('createOnAuthenticate', () => {
  it('authenticates with a valid token from data.token', async () => {
    const verifier = createTestVerifier();
    const { permissions } = await createTestPermissions();
    const onAuthenticate = createOnAuthenticate(verifier, permissions);

    const result = await onAuthenticate(makeAuthData({ token: 'dev' }));
    expect(result).toEqual({
      principal: expect.objectContaining({
        id: 'dev-user',
        actorType: 'human',
      }),
      readOnly: false,
    });
  });

  it('rejects when token is only in query string (security: no query string tokens)', async () => {
    const verifier = createTestVerifier();
    const { permissions } = await createTestPermissions();
    const onAuthenticate = createOnAuthenticate(verifier, permissions);

    const params = new URLSearchParams({ token: 'valid:Alice' });
    await expect(
      onAuthenticate(makeAuthData({ requestParameters: params })),
    ).rejects.toThrow('No authentication token provided');
  });

  it('ignores query string token when data.token is provided', async () => {
    const verifier = createTestVerifier();
    const { permissions } = await createTestPermissions();
    const onAuthenticate = createOnAuthenticate(verifier, permissions);

    const params = new URLSearchParams({ token: 'valid:QueryUser' });
    const result = await onAuthenticate(makeAuthData({
      token: 'valid:DataUser',
      requestParameters: params,
    }));
    const principal = result.principal as Principal;
    expect(principal.id).toBe('user-DataUser');
  });

  it('rejects when no token is provided', async () => {
    const verifier = createTestVerifier();
    const { permissions } = await createTestPermissions();
    const onAuthenticate = createOnAuthenticate(verifier, permissions);

    await expect(
      onAuthenticate(makeAuthData()),
    ).rejects.toThrow('No authentication token provided');
  });

  it('rejects when the token is invalid', async () => {
    const verifier = createTestVerifier();
    const { permissions } = await createTestPermissions();
    const onAuthenticate = createOnAuthenticate(verifier, permissions);

    await expect(
      onAuthenticate(makeAuthData({ token: 'bad-token' })),
    ).rejects.toThrow('Invalid token');
  });

  it('rejects when query string token is provided without data.token', async () => {
    const verifier = createTestVerifier();
    const { permissions } = await createTestPermissions();
    const onAuthenticate = createOnAuthenticate(verifier, permissions);

    const params = new URLSearchParams({ token: 'garbage' });
    await expect(
      onAuthenticate(makeAuthData({ requestParameters: params })),
    ).rejects.toThrow('No authentication token provided');
  });

  it('returns principal in context for downstream hooks', async () => {
    const verifier = createTestVerifier();
    const { permissions } = await createTestPermissions();
    const onAuthenticate = createOnAuthenticate(verifier, permissions);

    const result = await onAuthenticate(makeAuthData({ token: 'dev' }));
    expect(result).toHaveProperty('principal');
    expect((result as { principal: Principal }).principal).toHaveProperty('id');
    expect((result as { principal: Principal }).principal).toHaveProperty('actorType');
    expect((result as { principal: Principal }).principal).toHaveProperty('scopes');
  });

  // --- Issue #125 / CRIT-1: document-level permission gate ---

  it('rejects when authenticated user has no grant on the requested document (IDOR fix #125)', async () => {
    const verifier = createTestVerifier();
    const { permissions } = await createTestPermissions();
    const onAuthenticate = createOnAuthenticate(verifier, permissions);

    await expect(
      onAuthenticate(makeAuthData({ token: 'dev', documentName: 'private-doc-owned-by-someone-else' })),
    ).rejects.toThrow('Forbidden: no read access to document');
  });

  it('rejects another authenticated user from reading a private document', async () => {
    const verifier = createTestVerifier();
    const { permissions, grant } = await createTestPermissions();
    const onAuthenticate = createOnAuthenticate(verifier, permissions);

    // Alice owns this document.
    await grant('user-Alice', 'alice-private', 'owner');

    // DataUser tries to open Alice's doc with their own valid token.
    await expect(
      onAuthenticate(makeAuthData({ token: 'valid:DataUser', documentName: 'alice-private' })),
    ).rejects.toThrow('Forbidden: no read access to document');
  });

  it('marks the connection readOnly when the user has read but not write access', async () => {
    const verifier = createTestVerifier();
    const { permissions, grant } = await createTestPermissions();
    const onAuthenticate = createOnAuthenticate(verifier, permissions);

    // Alice owns the doc; Bob is a viewer.
    await grant('user-Alice', 'shared-doc', 'owner');
    await grant('user-Bob', 'shared-doc', 'viewer');

    const result = await onAuthenticate(makeAuthData({
      token: 'valid:Bob',
      documentName: 'shared-doc',
    })) as { principal: Principal; readOnly: boolean };

    expect(result.principal.id).toBe('user-Bob');
    expect(result.readOnly).toBe(true);
  });

  it('allows full read+write access when the user has editor or higher', async () => {
    const verifier = createTestVerifier();
    const { permissions, grant } = await createTestPermissions();
    const onAuthenticate = createOnAuthenticate(verifier, permissions);

    await grant('user-Carol', 'editable-doc', 'editor');

    const result = await onAuthenticate(makeAuthData({
      token: 'valid:Carol',
      documentName: 'editable-doc',
    })) as { principal: Principal; readOnly: boolean };

    expect(result.principal.id).toBe('user-Carol');
    expect(result.readOnly).toBe(false);
  });
});
