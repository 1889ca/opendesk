/** Contract: contracts/federation/rules.md */
import { describe, it, expect } from 'vitest';
import { signMessage, verifySignature, generateKeyPair, exportPublicKey, importPublicKey } from './signing.ts';
import type { FederatedMessage } from '../contract.ts';

describe('signing', () => {
  const { publicKey, privateKey } = generateKeyPair();

  const basePayload = {
    fromInstanceId: 'instance-a',
    toInstanceId: 'instance-b',
    type: 'test',
    payload: { data: 'hello' },
    timestamp: new Date().toISOString(),
  };

  it('signs and verifies a message', () => {
    const signature = signMessage(basePayload, privateKey);
    const message: FederatedMessage = { ...basePayload, signature };
    expect(verifySignature(message, publicKey)).toBe(true);
  });

  it('rejects a message with wrong key', () => {
    const otherPair = generateKeyPair();
    const signature = signMessage(basePayload, privateKey);
    const message: FederatedMessage = { ...basePayload, signature };
    expect(verifySignature(message, otherPair.publicKey)).toBe(false);
  });

  it('rejects a tampered message', () => {
    const signature = signMessage(basePayload, privateKey);
    const tampered: FederatedMessage = { ...basePayload, signature, type: 'tampered' };
    expect(verifySignature(tampered, publicKey)).toBe(false);
  });

  it('exports and imports public keys', () => {
    const exported = exportPublicKey(publicKey);
    expect(typeof exported).toBe('string');
    expect(exported.length).toBeGreaterThan(0);

    const imported = importPublicKey(exported);
    // Verify a message with the reimported key
    const signature = signMessage(basePayload, privateKey);
    const message: FederatedMessage = { ...basePayload, signature };
    expect(verifySignature(message, imported)).toBe(true);
  });
});
