/** Contract: contracts/auth/rules.md */

import { describe, it, expect } from 'vitest';
import { createServiceAccountManager, type ServiceAccountStorage } from './service-accounts.ts';
import { parseApiKey, verifyApiKeySecret } from './hash.ts';
import type { ServiceAccountRecord } from './apikey-verifier.ts';

function makeStorage(): ServiceAccountStorage & {
  records: Map<string, ServiceAccountRecord & { createdAt: string }>;
} {
  const records = new Map<string, ServiceAccountRecord & { createdAt: string }>();
  return {
    records,
    async insertServiceAccount(record) {
      records.set(record.id, record);
    },
    async findServiceAccountById(id) {
      return records.get(id) || null;
    },
    async revokeServiceAccount(id) {
      const record = records.get(id);
      if (record) record.revoked = true;
    },
  };
}

describe('Service Account Manager', () => {
  it('creates a service account and returns the full opd_ key once', async () => {
    const storage = makeStorage();
    const manager = createServiceAccountManager(storage);

    const sa = await manager.create({ displayName: 'Bot', scopes: ['read'] });
    expect(sa.id).toBeTruthy();
    expect(sa.apiKey.startsWith('opd_')).toBe(true);
    expect(sa.displayName).toBe('Bot');
    expect(sa.scopes).toEqual(['read']);
    expect(sa.createdAt).toBeTruthy();
  }, 15_000);

  it('embeds the account id in the api key (parseable)', async () => {
    const storage = makeStorage();
    const manager = createServiceAccountManager(storage);

    const sa = await manager.create({ displayName: 'Bot', scopes: [] });
    const parsed = parseApiKey(sa.apiKey);
    expect(parsed).not.toBeNull();
    expect(parsed?.accountId).toBe(sa.id);
  }, 15_000);

  it('stores a bcrypt secret hash, not the raw key', async () => {
    const storage = makeStorage();
    const manager = createServiceAccountManager(storage);

    const sa = await manager.create({ displayName: 'Bot', scopes: [] });
    const stored = storage.records.get(sa.id);
    expect(stored).toBeTruthy();
    expect(stored!.secretHash).toMatch(/^\$2[aby]\$/);
    expect(sa.apiKey).not.toContain(stored!.secretHash);

    // The stored bcrypt hash actually verifies the secret portion
    // of the issued key — round-trip integrity check.
    const parsed = parseApiKey(sa.apiKey);
    expect(parsed).not.toBeNull();
    const ok = await verifyApiKeySecret(parsed!.secret, stored!.secretHash);
    expect(ok).toBe(true);
  }, 15_000);

  it('read returns the masked key, never the original', async () => {
    const storage = makeStorage();
    const manager = createServiceAccountManager(storage);

    const sa = await manager.create({ displayName: 'Bot', scopes: ['write'] });
    const read = await manager.read(sa.id);
    expect(read).toBeTruthy();
    expect(read!.apiKey).toBe('***');
    expect(read!.displayName).toBe('Bot');
  }, 15_000);

  it('read returns null for an unknown id', async () => {
    const storage = makeStorage();
    const manager = createServiceAccountManager(storage);
    const read = await manager.read('nonexistent');
    expect(read).toBeNull();
  });

  it('revoke marks the account as revoked', async () => {
    const storage = makeStorage();
    const manager = createServiceAccountManager(storage);

    const sa = await manager.create({ displayName: 'Bot', scopes: [] });
    await manager.revoke(sa.id);

    const stored = storage.records.get(sa.id);
    expect(stored!.revoked).toBe(true);
  }, 15_000);
});
