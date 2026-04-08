/** Contract: contracts/federation/rules.md */
import * as crypto from 'node:crypto';
import type { FederatedMessage } from '../contract.ts';

/**
 * Sign a federated message payload with an Ed25519 private key.
 * Returns the base64-encoded signature.
 */
export function signMessage(
  payload: Omit<FederatedMessage, 'signature'>,
  privateKey: crypto.KeyObject,
): string {
  const data = canonicalize(payload);
  const signature = crypto.sign(null, Buffer.from(data), privateKey);
  return signature.toString('base64');
}

/**
 * Verify an Ed25519 signature on a federated message.
 * Returns true if the signature is valid.
 */
export function verifySignature(
  message: FederatedMessage,
  publicKey: crypto.KeyObject,
): boolean {
  const { signature, ...payload } = message;
  const data = canonicalize(payload);
  try {
    return crypto.verify(
      null,
      Buffer.from(data),
      publicKey,
      Buffer.from(signature, 'base64'),
    );
  } catch {
    return false;
  }
}

/**
 * Generate a new Ed25519 key pair for instance signing.
 */
export function generateKeyPair(): { publicKey: crypto.KeyObject; privateKey: crypto.KeyObject } {
  return crypto.generateKeyPairSync('ed25519');
}

/**
 * Export a public key to base64 for sharing with peers.
 */
export function exportPublicKey(key: crypto.KeyObject): string {
  return key.export({ type: 'spki', format: 'der' }).toString('base64');
}

/**
 * Import a base64-encoded public key from a peer.
 */
export function importPublicKey(base64Key: string): crypto.KeyObject {
  return crypto.createPublicKey({
    key: Buffer.from(base64Key, 'base64'),
    format: 'der',
    type: 'spki',
  });
}

/**
 * Deterministic JSON serialization for signing.
 * Keys are sorted to ensure consistent ordering.
 */
function canonicalize(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as Record<string, unknown>).sort());
}
