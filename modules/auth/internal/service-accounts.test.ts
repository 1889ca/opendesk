/** Contract: contracts/auth/rules.md */

import { describe, it, expect } from 'vitest';
import { createServiceAccountManager, type ServiceAccountStorage } from './service-accounts.ts';
import { hashApiKey } from './hash.ts';
import type { ServiceAccountRecord } from './apikey-verifier.ts';

function makeStorage(): ServiceAccountStorage & { records: Map<string, ServiceAccountRecord & { createdAt: string }> } {
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
  it('creates a service account and returns raw key', async () => {
    const storage = makeStorage();
    const manager = createServiceAccountManager(storage);

    const sa = await manager.create({ displayName: 'Bot', scopes: ['read'] });
    expect(sa.id).toBeTruthy();
    expect(sa.apiKey).toHaveLength(64); // hex-encoded 32 bytes
    expect(sa.displayName).toBe('Bot');
    expect(sa.scopes).toEqual(['read']);
    expect(sa.createdAt).toBeTruthy();
  });

  it('stores hashed key, not raw key', async () => {
    const storage = makeStorage();
    const manager = createServiceAccountManager(storage);

    const sa = await manager.create({ displayName: 'Bot', scopes: [] });
    const stored = storage.records.get(sa.id);
    expect(stored).toBeTruthy();
    expect(stored!.keyHash).toBe(hashApiKey(sa.apiKey));
    expect(stored!.keyHash).not.toBe(sa.apiKey);
  });

  it('read returns masked key', async () => {
    const storage = makeStorage();
    const manager = createServiceAccountManager(storage);

    const sa = await manager.create({ displayName: 'Bot', scopes: ['write'] });
    const read = await manager.read(sa.id);
    expect(read).toBeTruthy();
    expect(read!.apiKey).toBe('***');
    expect(read!.displayName).toBe('Bot');
  });

  it('read returns null for unknown id', async () => {
    const storage = makeStorage();
    const manager = createServiceAccountManager(storage);
    const read = await manager.read('nonexistent');
    expect(read).toBeNull();
  });

  it('revoke marks account as revoked', async () => {
    const storage = makeStorage();
    const manager = createServiceAccountManager(storage);

    const sa = await manager.create({ displayName: 'Bot', scopes: [] });
    await manager.revoke(sa.id);

    const stored = storage.records.get(sa.id);
    expect(stored!.revoked).toBe(true);
  });
});
