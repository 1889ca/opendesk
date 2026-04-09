/** Contract: contracts/auth/rules.md */

import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

/**
 * API key hashing (issue #133).
 *
 * Previous implementation hashed API keys with SHA-256, which is fast
 * enough that a leak of the hashes table would be brute-forceable on
 * modern GPUs despite the keys being 256-bit. The audit flagged this
 * as HIGH severity.
 *
 * The new format separates the public lookup id from the secret:
 *
 *     opd_<account-id-no-dashes>_<32-hex-bytes-secret>
 *
 * - The id portion is a UUID (without dashes for compactness) that
 *   doubles as the database lookup key. It is NOT a credential.
 * - The secret portion is 32 random bytes (hex-encoded). This is the
 *   actual credential and is bcrypt-hashed before storage.
 * - On verify: parse the key, look up the record by id (one indexed
 *   query, no SHA-256 lookup hash needed), then bcrypt.compare the
 *   secret against the stored hash. The cost factor matches what
 *   share-links uses for password hashing (12 rounds).
 *
 * Because the audit found NO production storage layer for service
 * accounts (the only wiring in api/internal/server.ts is a no-op
 * stub), no migration of existing keys is needed — there are none.
 */

const BCRYPT_ROUNDS = 12;
const KEY_PREFIX = 'opd_';
const SECRET_BYTES = 32;
const SECRET_HEX_LENGTH = SECRET_BYTES * 2;

export type ParsedApiKey = {
  /** UUID account id (with dashes restored). Used as the lookup key. */
  accountId: string;
  /** Hex-encoded random secret. Bcrypt-compared on verify. */
  secret: string;
};

/**
 * Generate a new API key for the given account id. Returns the
 * full key string ready to hand to the user, plus the bcrypt hash
 * of just the secret portion (which is what gets stored).
 *
 * The accountId is embedded in the key so verify can look up by id
 * with a single indexed query. Without that, verify would need
 * either a deterministic lookup hash (the SHA-256 we're moving away
 * from) or a full-table scan with bcrypt-compare per row.
 */
export async function generateApiKey(accountId: string): Promise<{
  apiKey: string;
  secretHash: string;
}> {
  const secret = randomBytes(SECRET_BYTES).toString('hex');
  const compactId = accountId.replace(/-/g, '');
  const apiKey = `${KEY_PREFIX}${compactId}_${secret}`;
  const secretHash = await bcrypt.hash(secret, BCRYPT_ROUNDS);
  return { apiKey, secretHash };
}

/**
 * Parse an API key string back into its account id and secret
 * components. Returns null if the format is invalid — callers should
 * treat that as an authentication failure.
 */
export function parseApiKey(apiKey: string): ParsedApiKey | null {
  if (typeof apiKey !== 'string' || !apiKey.startsWith(KEY_PREFIX)) {
    return null;
  }

  const body = apiKey.slice(KEY_PREFIX.length);
  const sep = body.lastIndexOf('_');
  if (sep === -1) return null;

  const compactId = body.slice(0, sep);
  const secret = body.slice(sep + 1);

  if (compactId.length !== 32 || !/^[0-9a-f]{32}$/i.test(compactId)) {
    return null;
  }
  if (secret.length !== SECRET_HEX_LENGTH || !/^[0-9a-f]+$/i.test(secret)) {
    return null;
  }

  // Restore UUID dashes for the lookup id.
  const accountId =
    compactId.slice(0, 8) +
    '-' +
    compactId.slice(8, 12) +
    '-' +
    compactId.slice(12, 16) +
    '-' +
    compactId.slice(16, 20) +
    '-' +
    compactId.slice(20);

  return { accountId, secret };
}

/**
 * Verify a parsed secret against a stored bcrypt hash. Constant-time
 * comparison is built into bcrypt.compare.
 */
export function verifyApiKeySecret(secret: string, secretHash: string): Promise<boolean> {
  return bcrypt.compare(secret, secretHash);
}

/** Generate a fresh service account id (UUID). */
export function generateAccountId(): string {
  return randomUUID();
}
