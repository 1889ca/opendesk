/** Contract: contracts/federation/rules.md */
import { createSign, createVerify, createHash } from 'node:crypto';

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
