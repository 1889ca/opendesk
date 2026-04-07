/** Contract: contracts/auth/rules.md */

import { randomUUID } from 'node:crypto';
import type { ServiceAccountDef, ServiceAccount, ServiceAccountManager } from '../contract.ts';
import { generateApiKey, hashApiKey } from './hash.ts';
import type { ServiceAccountRecord } from './apikey-verifier.ts';

/**
 * Storage interface for service account persistence.
 * Auth does not manage its own persistence (contract rule).
 */
export type ServiceAccountStorage = {
  insertServiceAccount(record: ServiceAccountRecord & { createdAt: string }): Promise<void>;
  findServiceAccountById(id: string): Promise<(ServiceAccountRecord & { createdAt: string }) | null>;
  revokeServiceAccount(id: string): Promise<void>;
};

/**
 * Service account manager. Handles create, read, revoke.
 * API keys are hashed before storage; raw keys returned only at creation.
 */
export function createServiceAccountManager(
  storage: ServiceAccountStorage,
): ServiceAccountManager {
  return {
    async create(def: ServiceAccountDef): Promise<ServiceAccount> {
      const id = randomUUID();
      const rawKey = generateApiKey();
      const keyHash = hashApiKey(rawKey);
      const createdAt = new Date().toISOString();

      await storage.insertServiceAccount({
        id,
        keyHash,
        displayName: def.displayName,
        scopes: def.scopes,
        revoked: false,
        createdAt,
      });

      // Raw key is returned exactly once — never stored or retrievable again
      return { id, apiKey: rawKey, displayName: def.displayName, scopes: def.scopes, createdAt };
    },

    async read(id: string): Promise<ServiceAccount | null> {
      const record = await storage.findServiceAccountById(id);
      if (!record) return null;

      // Never return the raw key after creation — return hash placeholder
      return {
        id: record.id,
        apiKey: '***',
        displayName: record.displayName,
        scopes: record.scopes,
        createdAt: record.createdAt,
      };
    },

    async revoke(id: string): Promise<void> {
      await storage.revokeServiceAccount(id);
    },
  };
}
