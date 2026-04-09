/** Contract: contracts/audit/yjs-signatures.md */

import { describe, it, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import {
  signUpdate,
  verifySignedUpdate,
  hashUpdate,
} from './yjs-signatures.ts';

function makeKeyPair() {
  return generateKeyPairSync('ed25519');
}

describe('yjs-signatures', () => {
  const docId = 'doc-001';
  const actorId = 'user-alice';
  const update = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

  it('hashUpdate produces a 64-char hex SHA-256', () => {
    const hash = hashUpdate(update);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashUpdate is deterministic', () => {
    expect(hashUpdate(update)).toBe(hashUpdate(update));
  });

  it('hashUpdate differs for different inputs', () => {
    const other = new Uint8Array([9, 10, 11]);
    expect(hashUpdate(update)).not.toBe(hashUpdate(other));
  });

  it('signUpdate produces a valid SignedUpdate', () => {
    const { privateKey } = makeKeyPair();
    const signed = signUpdate(update, docId, actorId, privateKey);

    expect(signed.documentId).toBe(docId);
    expect(signed.actorId).toBe(actorId);
    expect(signed.updateHash).toBe(hashUpdate(update));
    expect(signed.signature).toBeTruthy();
    expect(signed.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('verifySignedUpdate returns true for valid signature', () => {
    const { publicKey, privateKey } = makeKeyPair();
    const signed = signUpdate(update, docId, actorId, privateKey);
    expect(verifySignedUpdate(signed, publicKey)).toBe(true);
  });

  it('verifySignedUpdate returns false for wrong public key', () => {
    const { privateKey } = makeKeyPair();
    const { publicKey: wrongKey } = makeKeyPair();
    const signed = signUpdate(update, docId, actorId, privateKey);
    expect(verifySignedUpdate(signed, wrongKey)).toBe(false);
  });

  it('verifySignedUpdate returns false for tampered updateHash', () => {
    const { publicKey, privateKey } = makeKeyPair();
    const signed = signUpdate(update, docId, actorId, privateKey);
    signed.updateHash = 'a'.repeat(64);
    expect(verifySignedUpdate(signed, publicKey)).toBe(false);
  });

  it('verifySignedUpdate returns false for tampered actorId', () => {
    const { publicKey, privateKey } = makeKeyPair();
    const signed = signUpdate(update, docId, actorId, privateKey);
    signed.actorId = 'user-evil';
    expect(verifySignedUpdate(signed, publicKey)).toBe(false);
  });

  it('verifySignedUpdate returns false for tampered documentId', () => {
    const { publicKey, privateKey } = makeKeyPair();
    const signed = signUpdate(update, docId, actorId, privateKey);
    signed.documentId = 'doc-other';
    expect(verifySignedUpdate(signed, publicKey)).toBe(false);
  });

  it('verifySignedUpdate returns false for tampered timestamp', () => {
    const { publicKey, privateKey } = makeKeyPair();
    const signed = signUpdate(update, docId, actorId, privateKey);
    signed.timestamp = '2020-01-01T00:00:00.000Z';
    expect(verifySignedUpdate(signed, publicKey)).toBe(false);
  });
});
