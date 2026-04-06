/** Contract: contracts/auth/rules.md */

import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey } from './hash.ts';

describe('generateApiKey', () => {
  it('produces a 64-char hex string', () => {
    const key = generateApiKey();
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[0-9a-f]+$/);
  });

  it('produces unique keys', () => {
    const keys = new Set(Array.from({ length: 20 }, () => generateApiKey()));
    expect(keys.size).toBe(20);
  });
});

describe('hashApiKey', () => {
  it('produces a 64-char hex string (SHA-256)', () => {
    const hash = hashApiKey('test-key');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic', () => {
    const h1 = hashApiKey('same-key');
    const h2 = hashApiKey('same-key');
    expect(h1).toBe(h2);
  });

  it('hash differs from raw key', () => {
    const raw = generateApiKey();
    const hash = hashApiKey(raw);
    expect(hash).not.toBe(raw);
  });
});
