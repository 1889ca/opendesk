/** Contract: contracts/auth/rules.md */

import type { ApiKeyVerifier, VerificationResult } from '../contract.ts';
import { hashApiKey } from './hash.ts';

/**
 * Storage interface for service account lookups.
 * Decoupled from the actual storage module to avoid circular deps.
 */
export type ServiceAccountRecord = {
  id: string;
  keyHash: string;
  displayName: string;
  scopes: string[];
  revoked: boolean;
};

export type ServiceAccountStore = {
  findByKeyHash(keyHash: string): Promise<ServiceAccountRecord | null>;
};

/**
 * API key verifier. Hashes the incoming key and looks it up
 * in the service account store. Resolved principals have actorType 'agent'.
 */
export function createApiKeyVerifier(store: ServiceAccountStore): ApiKeyVerifier {
  return {
    async verifyApiKey(apiKey: string): Promise<VerificationResult> {
      if (!apiKey || typeof apiKey !== 'string') {
        return { ok: false, error: { code: 'KEY_INVALID', message: 'API key is empty' } };
      }

      const keyHash = hashApiKey(apiKey);
      const record = await store.findByKeyHash(keyHash);

      if (!record) {
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
