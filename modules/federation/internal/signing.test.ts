/** Contract: contracts/federation/rules.md */
import { describe, it, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { signPayload, verifySignature, sha256 } from './signing.ts';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

describe('federation signing', () => {
  it('signs and verifies a payload', () => {
    const payload = JSON.stringify({ test: 'data', timestamp: Date.now() });
    const signature = signPayload(payload, privateKey);
    expect(verifySignature(payload, signature, publicKey)).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const payload = JSON.stringify({ test: 'data' });
    const signature = signPayload(payload, privateKey);
    const tampered = JSON.stringify({ test: 'tampered' });
    expect(verifySignature(tampered, signature, publicKey)).toBe(false);
  });

  it('rejects with wrong public key', () => {
    const { publicKey: otherKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const payload = 'test payload';
    const signature = signPayload(payload, privateKey);
    expect(verifySignature(payload, signature, otherKey)).toBe(false);
  });

  it('sha256 produces consistent hashes', () => {
    const hash1 = sha256('hello world');
    const hash2 = sha256('hello world');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('sha256 produces different hashes for different inputs', () => {
    expect(sha256('a')).not.toBe(sha256('b'));
  });
});
