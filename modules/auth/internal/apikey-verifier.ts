/** Contract: contracts/auth/rules.md */

import type { ApiKeyVerifier, VerificationResult } from '../contract.ts';
import { parseApiKey, verifyApiKeySecret } from './hash.ts';

/**
 * Storage interface for service account lookups.
 * Decoupled from the actual storage module to avoid circular deps.
 *
 * The lookup is by account id (parsed out of the API key prefix),
 * not by hash. This is the change behind issue #133: bcrypt hashes
 * include a random salt and can't be looked up directly, so the
 * verifier parses the account id from the API key, fetches the
 * record by id, then bcrypt-compares the secret portion.
 */
export type ServiceAccountRecord = {
  id: string;
  /** bcrypt hash of the secret portion of the API key. */
  secretHash: string;
  displayName: string;
  scopes: string[];
  revoked: boolean;
};

export type ServiceAccountStore = {
  findById(id: string): Promise<ServiceAccountRecord | null>;
};

/**
 * API key verifier. Parses the incoming key, looks up the service
 * account by id, and bcrypt-compares the secret. Resolved principals
 * have actorType 'agent'.
 */
export function createApiKeyVerifier(store: ServiceAccountStore): ApiKeyVerifier {
  return {
    async verifyApiKey(apiKey: string): Promise<VerificationResult> {
      const parsed = parseApiKey(apiKey);
      if (!parsed) {
        return { ok: false, error: { code: 'KEY_INVALID', message: 'API key format is invalid' } };
      }

      const record = await store.findById(parsed.accountId);
      if (!record) {
        return { ok: false, error: { code: 'KEY_INVALID', message: 'API key not recognized' } };
      }

      const secretMatches = await verifyApiKeySecret(parsed.secret, record.secretHash);
      if (!secretMatches) {
        return { ok: false, error: { code: 'KEY_INVALID', message: 'API key not recognized' } };
      }

      if (record.revoked) {
        return { ok: false, error: { code: 'KEY_REVOKED', message: 'API key has been revoked' } };
      }

      return {
        ok: true,
        principal: {
          id: record.id,
          actorType: 'agent',
          displayName: record.displayName,
          scopes: record.scopes,
        },
      };
    },
  };
}
