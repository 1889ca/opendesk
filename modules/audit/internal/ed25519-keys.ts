/** Contract: contracts/audit/yjs-signatures.md */

import { generateKeyPairSync, createPublicKey, type KeyObject } from 'node:crypto';
import type { Pool } from 'pg';

export type SigningKeyPair = {
  actorId: string;
  publicKey: KeyObject;
  privateKey: KeyObject;
  createdAt: string;
};

export type PublicKeyRecord = {
  actorId: string;
  publicKeyPem: string;
  createdAt: string;
};

/** Generate a new Ed25519 key pair for a user. */
export function generateSigningKeyPair(): { publicKey: KeyObject; privateKey: KeyObject } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { publicKey, privateKey };
}

/** Store a user's public key in the database. */
export async function storePublicKey(
  pool: Pool,
  actorId: string,
  publicKey: KeyObject,
): Promise<void> {
  const pem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
  await pool.query(
    `INSERT INTO user_signing_keys (actor_id, public_key_pem, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (actor_id) DO UPDATE SET public_key_pem = $2, created_at = NOW()`,
    [actorId, pem],
  );
}

/** Load a user's public key from the database. */
export async function loadPublicKey(
  pool: Pool,
  actorId: string,
): Promise<KeyObject | null> {
  const result = await pool.query(
    `SELECT public_key_pem FROM user_signing_keys WHERE actor_id = $1`,
    [actorId],
  );
  if (result.rows.length === 0) return null;
  return createPublicKey(result.rows[0].public_key_pem as string);
}

/** Load all public keys (for batch verification). */
export async function loadAllPublicKeys(
  pool: Pool,
): Promise<Map<string, KeyObject>> {
  const result = await pool.query(
    `SELECT actor_id, public_key_pem FROM user_signing_keys`,
  );
  const keys = new Map<string, KeyObject>();
  for (const row of result.rows) {
    keys.set(
      row.actor_id as string,
      createPublicKey(row.public_key_pem as string),
    );
  }
  return keys;
}
