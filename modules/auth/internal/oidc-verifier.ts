/** Contract: contracts/auth/rules.md */

import * as jose from 'jose';
import type { TokenVerifier, VerificationResult } from '../contract.ts';
import type { AuthConfig } from './config.ts';

/**
 * OIDC token verifier. Discovers the provider's JWKS and validates
 * JWT bearer tokens. Resolved principals always have actorType 'human'.
 *
 * No caching of principals across requests (contract invariant).
 * JWKS caching is handled internally by jose.
 */
export function createOidcVerifier(config: AuthConfig): TokenVerifier {
  let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

  async function getJwks(): Promise<ReturnType<typeof jose.createRemoteJWKSet>> {
    if (jwks) return jwks;
    const issuerUrl = config.oidcIssuer.replace(/\/$/, '');
    const discoveryUrl = `${issuerUrl}/.well-known/openid-configuration`;

    let discovery: { jwks_uri: string };
    try {
      const res = await fetch(discoveryUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      discovery = (await res.json()) as { jwks_uri: string };
    } catch {
      throw new ProviderUnreachableError(issuerUrl);
    }

    jwks = jose.createRemoteJWKSet(new URL(discovery.jwks_uri));
    return jwks;
  }

  return {
    async verifyToken(token: string): Promise<VerificationResult> {
      if (!token || typeof token !== 'string') {
        return { ok: false, error: { code: 'TOKEN_MALFORMED', message: 'Token is empty or not a string' } };
      }

      let keySet: ReturnType<typeof jose.createRemoteJWKSet>;
      try {
        keySet = await getJwks();
      } catch (err) {
        if (err instanceof ProviderUnreachableError) {
          return { ok: false, error: { code: 'PROVIDER_UNREACHABLE', message: err.message } };
        }
        return { ok: false, error: { code: 'PROVIDER_UNREACHABLE', message: 'Failed to fetch JWKS' } };
      }

      try {
        const { payload } = await jose.jwtVerify(token, keySet, {
          issuer: config.oidcIssuer,
          audience: config.oidcAudience,
        });

        const id = (payload.sub as string) || '';
        if (!id) {
          return { ok: false, error: { code: 'TOKEN_INVALID', message: 'Token missing sub claim' } };
        }

        return {
          ok: true,
          principal: {
            id,
            actorType: 'human',
            displayName: (payload.name as string) || (payload.preferred_username as string) || id,
            email: (payload.email as string) || undefined,
            scopes: parseScopeClaim(payload),
          },
        };
      } catch (err) {
        return { ok: false, error: classifyJoseError(err) };
      }
    },
  };
}

function parseScopeClaim(payload: jose.JWTPayload): string[] {
  if (typeof payload.scope === 'string') {
    return payload.scope.split(' ').filter(Boolean);
  }
  if (Array.isArray(payload.scope)) {
    return payload.scope.filter((s): s is string => typeof s === 'string');
  }
  return [];
}

function classifyJoseError(err: unknown): { code: 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'TOKEN_MALFORMED'; message: string } {
  if (err instanceof jose.errors.JWTExpired) {
    return { code: 'TOKEN_EXPIRED', message: 'Token has expired' };
  }
  if (err instanceof jose.errors.JWTClaimValidationFailed) {
    return { code: 'TOKEN_INVALID', message: `Claim validation failed: ${err.message}` };
  }
  if (err instanceof jose.errors.JWSSignatureVerificationFailed) {
    return { code: 'TOKEN_INVALID', message: 'Signature verification failed' };
  }
  return { code: 'TOKEN_MALFORMED', message: `Invalid token: ${err instanceof Error ? err.message : 'unknown'}` };
}

class ProviderUnreachableError extends Error {
  constructor(issuer: string) {
    super(`OIDC provider unreachable: ${issuer}`);
    this.name = 'ProviderUnreachableError';
  }
}
