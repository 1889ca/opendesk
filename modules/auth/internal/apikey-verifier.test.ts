/** Contract: contracts/auth/rules.md */

import { describe, it, expect } from 'vitest';
import { createApiKeyVerifier, type ServiceAccountStore, type ServiceAccountRecord } from './apikey-verifier.ts';
import { hashApiKey } from './hash.ts';

function makeStore(records: ServiceAccountRecord[]): ServiceAccountStore {
  return {
    async findByKeyHash(keyHash: string) {
      return records.find((r) => r.keyHash === keyHash) || null;
    },
  };
}

describe('API Key Verifier', () => {
  const rawKey = 'test-api-key-abc123';
  const keyHash = hashApiKey(rawKey);

  const activeRecord: ServiceAccountRecord = {
    id: 'sa-1',
    keyHash,
    displayName: 'Test Agent',
    scopes: ['documents.read'],
    revoked: false,
  };

  const revokedRecord: ServiceAccountRecord = {
    ...activeRecord,
    id: 'sa-2',
    keyHash: hashApiKey('revoked-key'),
    revoked: true,
  };

  it('resolves valid key to agent principal', async () => {
    const verifier = createApiKeyVerifier(makeStore([activeRecord]));
    const result = await verifier.verifyApiKey(rawKey);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.actorType).toBe('agent');
    expect(result.principal.id).toBe('sa-1');
    expect(result.principal.displayName).toBe('Test Agent');
    expect(result.principal.scopes).toEqual(['documents.read']);
  });

  it('rejects unknown key', async () => {
    const verifier = createApiKeyVerifier(makeStore([activeRecord]));
    const result = await verifier.verifyApiKey('unknown-key');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('KEY_INVALID');
  });

  it('rejects revoked key', async () => {
    const verifier = createApiKeyVerifier(makeStore([revokedRecord]));
    const result = await verifier.verifyApiKey('revoked-key');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('KEY_REVOKED');
  });

  it('rejects empty key', async () => {
    const verifier = createApiKeyVerifier(makeStore([]));
    const result = await verifier.verifyApiKey('');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('KEY_INVALID');
  });

  it('same key resolves to same id (stable identity)', async () => {
    const verifier = createApiKeyVerifier(makeStore([activeRecord]));
    const r1 = await verifier.verifyApiKey(rawKey);
    const r2 = await verifier.verifyApiKey(rawKey);
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r1.principal.id).toBe(r2.principal.id);
    }
  });
});
