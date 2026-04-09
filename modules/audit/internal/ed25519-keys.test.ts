/** Contract: contracts/audit/yjs-signatures.md */

import { describe, it, expect } from 'vitest';
import { generateSigningKeyPair } from './ed25519-keys.ts';

describe('ed25519-keys', () => {
  it('generates a valid Ed25519 key pair', () => {
    const { publicKey, privateKey } = generateSigningKeyPair();
    expect(publicKey.type).toBe('public');
    expect(privateKey.type).toBe('private');
    expect(publicKey.asymmetricKeyType).toBe('ed25519');
    expect(privateKey.asymmetricKeyType).toBe('ed25519');
  });

  it('generates unique key pairs on each call', () => {
    const pair1 = generateSigningKeyPair();
    const pair2 = generateSigningKeyPair();
    const pem1 = pair1.publicKey.export({ type: 'spki', format: 'pem' });
    const pem2 = pair2.publicKey.export({ type: 'spki', format: 'pem' });
    expect(pem1).not.toBe(pem2);
  });

  it('exports public key as PEM', () => {
    const { publicKey } = generateSigningKeyPair();
    const pem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
    expect(pem).toContain('BEGIN PUBLIC KEY');
    expect(pem).toContain('END PUBLIC KEY');
  });

  it('exports private key as PEM', () => {
    const { privateKey } = generateSigningKeyPair();
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    expect(pem).toContain('BEGIN PRIVATE KEY');
    expect(pem).toContain('END PRIVATE KEY');
  });
});
