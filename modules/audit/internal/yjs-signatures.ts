/** Contract: contracts/audit/yjs-signatures.md */

import { createHash, sign, verify, type KeyObject } from 'node:crypto';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { loadPublicKey, loadAllPublicKeys } from './ed25519-keys.ts';

export type SignedUpdate = {
  id: string;
  updateHash: string;
  signature: string;
  actorId: string;
  documentId: string;
  timestamp: string;
};

export type SignatureVerifyResult = {
  documentId: string;
  totalUpdates: number;
  verified: boolean;
  failedAt: number | null;
  failedActorId: string | null;
};

/** Compute SHA-256 hash of raw Yjs update bytes. */
export function hashUpdate(update: Uint8Array): string {
  return createHash('sha256').update(update).digest('hex');
}

/** Build the canonical signing payload. */
function buildSignPayload(
  updateHash: string,
  documentId: string,
  actorId: string,
  timestamp: string,
): Buffer {
  const canonical = [updateHash, documentId, actorId, timestamp].join('|');
  return Buffer.from(canonical, 'utf-8');
}

/** Sign a Yjs update with an Ed25519 private key. */
export function signUpdate(
  update: Uint8Array,
  documentId: string,
  actorId: string,
  privateKey: KeyObject,
): SignedUpdate {
  const updateHash = hashUpdate(update);
  const timestamp = new Date().toISOString();
  const payload = buildSignPayload(updateHash, documentId, actorId, timestamp);
  const signature = sign(null, payload, privateKey).toString('base64');

  return {
    id: randomUUID(),
    updateHash,
    signature,
    actorId,
    documentId,
    timestamp,
  };
}

/** Verify a single signed update against its public key. */
export function verifySignedUpdate(
  signed: SignedUpdate,
  publicKey: KeyObject,
): boolean {
  const payload = buildSignPayload(
    signed.updateHash,
    signed.documentId,
    signed.actorId,
    signed.timestamp,
  );
  return verify(null, payload, publicKey, Buffer.from(signed.signature, 'base64'));
}

/** Store a signed update record in the database. */
export async function storeSignedUpdate(
  pool: Pool,
  signed: SignedUpdate,
): Promise<void> {
  await pool.query(
    `INSERT INTO yjs_update_signatures
       (id, update_hash, signature, actor_id, document_id, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      signed.id,
      signed.updateHash,
      signed.signature,
      signed.actorId,
      signed.documentId,
      signed.timestamp,
    ],
  );
}

/** Load all signed updates for a document (chronological). */
export async function loadSignedUpdates(
  pool: Pool,
  documentId: string,
): Promise<SignedUpdate[]> {
  const result = await pool.query(
    `SELECT id, update_hash, signature, actor_id, document_id, timestamp
     FROM yjs_update_signatures
     WHERE document_id = $1
     ORDER BY timestamp ASC, id ASC`,
    [documentId],
  );
  return result.rows.map(mapSignedRow);
}

/** Verify all update signatures for a document. */
export async function verifyDocumentSignatures(
  pool: Pool,
  documentId: string,
): Promise<SignatureVerifyResult> {
  const updates = await loadSignedUpdates(pool, documentId);
  if (updates.length === 0) {
    return { documentId, totalUpdates: 0, verified: true, failedAt: null, failedActorId: null };
  }

  const keys = await loadAllPublicKeys(pool);

  for (let i = 0; i < updates.length; i++) {
    const update = updates[i];
    const publicKey = keys.get(update.actorId);
    if (!publicKey) {
      return {
        documentId,
        totalUpdates: updates.length,
        verified: false,
        failedAt: i,
        failedActorId: update.actorId,
      };
    }
    if (!verifySignedUpdate(update, publicKey)) {
      return {
        documentId,
        totalUpdates: updates.length,
        verified: false,
        failedAt: i,
        failedActorId: update.actorId,
      };
    }
  }

  return { documentId, totalUpdates: updates.length, verified: true, failedAt: null, failedActorId: null };
}

function mapSignedRow(row: Record<string, unknown>): SignedUpdate {
  return {
    id: row.id as string,
    updateHash: row.update_hash as string,
    signature: row.signature as string,
    actorId: row.actor_id as string,
    documentId: row.document_id as string,
    timestamp: row.timestamp instanceof Date
      ? (row.timestamp as Date).toISOString()
      : (row.timestamp as string),
  };
}
