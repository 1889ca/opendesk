/** Contract: contracts/auth/rules.md */

import { describe, it, expect } from 'vitest';
import {
  createApiKeyVerifier,
  type ServiceAccountStore,
  type ServiceAccountRecord,
} from './apikey-verifier.ts';
import { generateApiKey, generateAccountId } from './hash.ts';

function makeStore(records: ServiceAccountRecord[]): ServiceAccountStore {
  return {
    async findById(id: string) {
      return records.find((r) => r.id === id) || null;
    },
  };
}

describe('API Key Verifier', () => {
  it('resolves a valid key to an agent principal', async () => {
    const accountId = generateAccountId();
    const { apiKey, secretHash } = await generateApiKey(accountId);

    const record: ServiceAccountRecord = {
      id: accountId,
      secretHash,
      displayName: 'Test Agent',
      scopes: ['documents.read'],
      revoked: false,
    };
    const verifier = createApiKeyVerifier(makeStore([record]));

    const result = await verifier.verifyApiKey(apiKey);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.actorType).toBe('agent');
    expect(result.principal.id).toBe(accountId);
    expect(result.principal.displayName).toBe('Test Agent');
    expect(result.principal.scopes).toEqual(['documents.read']);
  }, 15_000);

  it('rejects a key whose account id is not in the store', async () => {
    const accountId = generateAccountId();
    const otherId = generateAccountId();
    const { apiKey, secretHash } = await generateApiKey(accountId);

    const record: ServiceAccountRecord = {
      id: otherId, // Store has a DIFFERENT id
      secretHash,
      displayName: 'Other',
      scopes: [],
      revoked: false,
    };
    const verifier = createApiKeyVerifier(makeStore([record]));

    const result = await verifier.verifyApiKey(apiKey);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('KEY_INVALID');
  }, 15_000);

  it('rejects a key whose secret does not match the stored hash', async () => {
    const accountId = generateAccountId();
    const { apiKey: legitKey, secretHash } = await generateApiKey(accountId);

    // Tamper with the secret portion of the apiKey while keeping the
    // account id intact. The store finds the record by id but the
    // bcrypt compare fails.
    const tampered = legitKey.slice(0, -64) + 'b'.repeat(64);

    const record: ServiceAccountRecord = {
      id: accountId,
      secretHash,
      displayName: 'Tampered',
      scopes: [],
      revoked: false,
    };
    const verifier = createApiKeyVerifier(makeStore([record]));

    const result = await verifier.verifyApiKey(tampered);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('KEY_INVALID');
  }, 15_000);

  it('rejects a malformed key', async () => {
    const verifier = createApiKeyVerifier(makeStore([]));
    const result = await verifier.verifyApiKey('not-a-real-key');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('KEY_INVALID');
  });

  it('rejects an empty key', async () => {
    const verifier = createApiKeyVerifier(makeStore([]));
    const result = await verifier.verifyApiKey('');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('KEY_INVALID');
  });

  it('rejects a revoked key (after the secret check passes)', async () => {
    const accountId = generateAccountId();
    const { apiKey, secretHash } = await generateApiKey(accountId);

    const record: ServiceAccountRecord = {
      id: accountId,
      secretHash,
      displayName: 'Revoked',
      scopes: [],
      revoked: true,
    };
    const verifier = createApiKeyVerifier(makeStore([record]));

    const result = await verifier.verifyApiKey(apiKey);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('KEY_REVOKED');
  }, 15_000);

  it('same key resolves to same id (stable identity)', async () => {
    const accountId = generateAccountId();
    const { apiKey, secretHash } = await generateApiKey(accountId);

    const record: ServiceAccountRecord = {
      id: accountId,
      secretHash,
      displayName: 'Stable',
      scopes: [],
      revoked: false,
    };
    const verifier = createApiKeyVerifier(makeStore([record]));

    const r1 = await verifier.verifyApiKey(apiKey);
    const r2 = await verifier.verifyApiKey(apiKey);
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r1.principal.id).toBe(r2.principal.id);
    }
  }, 15_000);
});
