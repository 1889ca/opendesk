/** Contract: contracts/auth/rules.md */

import type { TokenVerifier, VerificationResult, ApiKeyVerifier } from '../contract.ts';

/**
 * Dev-mode token verifier. When AUTH_MODE=dev, this accepts
 * bearer tokens in the format "dev:<id>:<displayName>:<scopes>"
 * (e.g., "dev:user1:Alice:read,write") and resolves them
 * without cryptographic verification.
 *
 * Also accepts a simple "dev" token that creates a default user.
 * NEVER use in production.
 */
export function createDevTokenVerifier(): TokenVerifier {
  return {
    async verifyToken(token: string): Promise<VerificationResult> {
      if (!token || typeof token !== 'string') {
        return { ok: false, error: { code: 'TOKEN_MALFORMED', message: 'Token is empty' } };
      }

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

      if (!token.startsWith('dev:')) {
        return { ok: false, error: { code: 'TOKEN_MALFORMED', message: 'Dev token must start with "dev:"' } };
      }

      const parts = token.split(':');
      if (parts.length < 3) {
        return { ok: false, error: { code: 'TOKEN_MALFORMED', message: 'Dev token format: dev:<id>:<name>[:<scopes>]' } };
      }

      const [, id, displayName, scopeStr] = parts;
      const scopes = scopeStr ? scopeStr.split(',').filter(Boolean) : ['*'];

      return {
        ok: true,
        principal: {
          id: id!,
          actorType: 'human',
          displayName: displayName!,
          email: `${id}@opendesk.local`,
          scopes,
        },
      };
    },
  };
}

/**
 * Dev-mode API key verifier. Accepts any key prefixed with "devkey:".
 */
export function createDevApiKeyVerifier(): ApiKeyVerifier {
  return {
    async verifyApiKey(apiKey: string): Promise<VerificationResult> {
      if (!apiKey.startsWith('devkey:')) {
        return { ok: false, error: { code: 'KEY_INVALID', message: 'Invalid dev API key' } };
      }

      const id = apiKey.slice('devkey:'.length);
      return {
        ok: true,
        principal: {
          id: `agent-${id}`,
          actorType: 'agent',
          displayName: `Dev Agent ${id}`,
          scopes: ['*'],
        },
      };
    },
  };
}
