/** Contract: contracts/auth/rules.md */

import { createHash, randomBytes } from 'node:crypto';

/**
 * Generate a cryptographically random API key.
 * Returns the raw key string (hex-encoded).
 */
export function generateApiKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash an API key using SHA-256.
 * Used before storing — raw keys are never persisted.
 */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}
