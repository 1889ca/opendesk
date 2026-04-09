/** Contract: contracts/auth/rules.md */

import { describe, it, expect } from 'vitest';
import {
  generateApiKey,
  generateAccountId,
  parseApiKey,
  verifyApiKeySecret,
} from './hash.ts';

describe('generateAccountId', () => {
  it('produces a UUID v4 string', () => {
    const id = generateAccountId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('produces unique ids', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateAccountId()));
    expect(ids.size).toBe(20);
  });
});

describe('generateApiKey', () => {
  it('returns a key with the opd_ prefix and an embedded account id', async () => {
    const accountId = generateAccountId();
    const { apiKey } = await generateApiKey(accountId);
    expect(apiKey.startsWith('opd_')).toBe(true);
    // Compact id (no dashes) should appear right after the prefix.
    expect(apiKey).toContain(accountId.replace(/-/g, ''));
  });

  it('returns a bcrypt secret hash (not the raw secret)', async () => {
    const accountId = generateAccountId();
    const { apiKey, secretHash } = await generateApiKey(accountId);
    // bcrypt hashes start with $2a$, $2b$, or $2y$.
    expect(secretHash).toMatch(/^\$2[aby]\$/);
    // The full apiKey must NOT contain the bcrypt hash, and the
    // bcrypt hash must NOT contain the secret portion of the key.
    expect(apiKey).not.toContain(secretHash);
  });

  it('produces unique keys for the same account on repeat calls', async () => {
    const accountId = generateAccountId();
    const a = await generateApiKey(accountId);
    const b = await generateApiKey(accountId);
    expect(a.apiKey).not.toBe(b.apiKey);
    expect(a.secretHash).not.toBe(b.secretHash);
  });
});

describe('parseApiKey', () => {
  it('round-trips a freshly generated key', async () => {
    const accountId = generateAccountId();
    const { apiKey } = await generateApiKey(accountId);
    const parsed = parseApiKey(apiKey);
    expect(parsed).not.toBeNull();
    expect(parsed?.accountId).toBe(accountId);
    expect(parsed?.secret).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns null for missing prefix', () => {
    expect(parseApiKey('not-a-key')).toBeNull();
    expect(parseApiKey('1234567890abcdef')).toBeNull();
  });

  it('returns null for malformed body (no separator)', () => {
    expect(parseApiKey('opd_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBeNull();
  });

  it('returns null for wrong-length compact id', () => {
    expect(parseApiKey('opd_short_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBeNull();
  });

  it('returns null for wrong-length secret', () => {
    expect(parseApiKey('opd_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_short')).toBeNull();
  });

  it('returns null for non-hex characters', () => {
    expect(parseApiKey('opd_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseApiKey('')).toBeNull();
  });
});

describe('verifyApiKeySecret', () => {
  it('returns true for the matching secret', async () => {
    const accountId = generateAccountId();
    const { apiKey, secretHash } = await generateApiKey(accountId);
    const parsed = parseApiKey(apiKey);
    expect(parsed).not.toBeNull();
    const ok = await verifyApiKeySecret(parsed!.secret, secretHash);
    expect(ok).toBe(true);
  });

  it('returns false for a different secret', async () => {
    const accountId = generateAccountId();
    const { secretHash } = await generateApiKey(accountId);
    const ok = await verifyApiKeySecret('a'.repeat(64), secretHash);
    expect(ok).toBe(false);
  });

  it('returns false for a malformed hash', async () => {
    const ok = await verifyApiKeySecret('any-secret', 'not-a-bcrypt-hash');
    expect(ok).toBe(false);
  });
});
