/** Contract: contracts/auth/rules.md */

import type { ServiceAccountDef, ServiceAccount, ServiceAccountManager } from '../contract.ts';
import { generateApiKey, generateAccountId } from './hash.ts';
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
 *
 * Issue #133: API keys are now bcrypt-hashed via the new format
 * `opd_<account-id>_<secret>`. The full key is returned to the
 * caller exactly once at creation; only the bcrypt hash of the
 * secret portion is persisted.
 */
export function createServiceAccountManager(
  storage: ServiceAccountStorage,
): ServiceAccountManager {
  return {
    async create(def: ServiceAccountDef): Promise<ServiceAccount> {
      const id = generateAccountId();
      const { apiKey, secretHash } = await generateApiKey(id);
      const createdAt = new Date().toISOString();

      await storage.insertServiceAccount({
        id,
        secretHash,
        displayName: def.displayName,
        scopes: def.scopes,
        revoked: false,
        createdAt,
      });

      // Raw key returned exactly once — never stored or retrievable again.
      return { id, apiKey, displayName: def.displayName, scopes: def.scopes, createdAt };
    },

    async read(id: string): Promise<ServiceAccount | null> {
      const record = await storage.findServiceAccountById(id);
      if (!record) return null;

      // Never return the raw key after creation — return masked placeholder.
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
