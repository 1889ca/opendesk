/** Contract: contracts/collab/rules.md */
import { describe, it, expect } from 'vitest';
import { createOnAuthenticate } from './authenticate.ts';
import type { TokenVerifier, VerificationResult, Principal } from '../../auth/contract.ts';

/** Creates a real dev-style token verifier for testing. */
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

function makeAuthData(overrides: Partial<{
  token: string;
  documentName: string;
  requestParameters: URLSearchParams;
}> = {}) {
  return {
    token: overrides.token ?? '',
    documentName: overrides.documentName ?? 'doc-1',
    connection: { readOnly: false },
    requestHeaders: {},
    requestParameters: overrides.requestParameters ?? new URLSearchParams(),
  };
}

describe('createOnAuthenticate', () => {
  const verifier = createTestVerifier();
  const onAuthenticate = createOnAuthenticate(verifier);

  it('authenticates with a valid token from data.token', async () => {
    const result = await onAuthenticate(makeAuthData({ token: 'dev' }));
    expect(result).toEqual({
      principal: expect.objectContaining({
        id: 'dev-user',
        actorType: 'human',
      }),
    });
  });

  it('authenticates with a valid token from query string', async () => {
    const params = new URLSearchParams({ token: 'valid:Alice' });
    const result = await onAuthenticate(makeAuthData({
      requestParameters: params,
    }));
    const principal = result.principal as Principal;
    expect(principal.id).toBe('user-Alice');
    expect(principal.displayName).toBe('Alice');
  });

  it('prefers data.token over query string token', async () => {
    const params = new URLSearchParams({ token: 'valid:QueryUser' });
    const result = await onAuthenticate(makeAuthData({
      token: 'valid:DataUser',
      requestParameters: params,
    }));
    const principal = result.principal as Principal;
    expect(principal.id).toBe('user-DataUser');
  });

  it('rejects when no token is provided', async () => {
    await expect(
      onAuthenticate(makeAuthData()),
    ).rejects.toThrow('No authentication token provided');
  });

  it('rejects when the token is invalid', async () => {
    await expect(
      onAuthenticate(makeAuthData({ token: 'bad-token' })),
    ).rejects.toThrow('Invalid token');
  });

  it('rejects when query string token is invalid', async () => {
    const params = new URLSearchParams({ token: 'garbage' });
    await expect(
      onAuthenticate(makeAuthData({ requestParameters: params })),
    ).rejects.toThrow('Invalid token');
  });

  it('returns principal in context for downstream hooks', async () => {
    const result = await onAuthenticate(makeAuthData({ token: 'dev' }));
    expect(result).toHaveProperty('principal');
    expect(result.principal).toHaveProperty('id');
    expect(result.principal).toHaveProperty('actorType');
    expect(result.principal).toHaveProperty('scopes');
  });
});
