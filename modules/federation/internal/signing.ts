/** Contract: contracts/federation/rules.md */
import { createSign, createVerify, createHash, generateKeyPairSync, createPublicKey, type KeyObject } from 'node:crypto';

/**
 * Sign a transfer bundle payload with the instance's private key (RSA-SHA256).
 */
export function signPayload(payload: string, privateKey: string): string {
  const signer = createSign('RSA-SHA256');
  signer.update(payload);
  return signer.sign(privateKey, 'base64');
}

/**
 * Verify a transfer bundle signature against a peer's public key.
 */
export function verifySignature(payload: string, signature: string, publicKey: string): boolean {
  try {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(payload);
    return verifier.verify(publicKey, signature, 'base64');
  } catch {
    return false;
  }
}

/**
 * SHA-256 hash of an arbitrary string (for audit proof fingerprinting).
 */
export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Generate an RSA key pair for signing federation messages.
 */
export function generateKeyPair(): { publicKey: KeyObject; privateKey: KeyObject } {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  return { publicKey, privateKey };
}

/**
 * Export a public key to base64-encoded SPKI format.
 */
export function exportPublicKey(key: KeyObject): string {
  return key.export({ type: 'spki', format: 'pem' }) as string;
}

/**
 * Import a public key from PEM string.
 */
export function importPublicKey(pem: string): KeyObject {
  return createPublicKey(pem);
}

/**
 * Sign a federated message object with an RSA private key.
 */
export function signMessage(payload: Record<string, unknown>, privateKey: KeyObject): string {
  const data = JSON.stringify(payload);
  const signer = createSign('RSA-SHA256');
  signer.update(data);
  return signer.sign(privateKey, 'base64');
}

/**
 * Verify a signed federated message against a public key.
 */
export function verifyMessage(message: Record<string, unknown> & { signature: string }, publicKey: KeyObject): boolean {
  const { signature, ...payload } = message;
  const data = JSON.stringify(payload);
  try {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(data);
    return verifier.verify(publicKey, signature, 'base64');
  } catch {
    return false;
  }
}
