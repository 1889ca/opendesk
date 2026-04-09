/** Contract: contracts/federation/rules.md */
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { FederationPeer, TransferRecord } from '../contract.ts';

// --- Peers ---

export async function insertPeer(pool: Pool, peer: FederationPeer): Promise<void> {
  await pool.query(
    `INSERT INTO federation_peers (id, name, endpoint_url, public_key, trust_level, status, registered_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [peer.id, peer.name, peer.endpointUrl, peer.publicKey, peer.trustLevel, peer.status, peer.registeredBy],
  );
}

export async function listPeers(pool: Pool): Promise<FederationPeer[]> {
  const result = await pool.query(
    `SELECT id, name, endpoint_url, public_key, trust_level, status, last_seen_at, registered_by, created_at
     FROM federation_peers ORDER BY created_at DESC`,
  );
  return result.rows.map(mapPeerRow);
}

export async function getPeer(pool: Pool, peerId: string): Promise<FederationPeer | null> {
  const result = await pool.query(
    `SELECT id, name, endpoint_url, public_key, trust_level, status, last_seen_at, registered_by, created_at
     FROM federation_peers WHERE id = $1`,
    [peerId],
  );
  return result.rows.length > 0 ? mapPeerRow(result.rows[0]) : null;
}

export async function getPeerByEndpoint(pool: Pool, endpointUrl: string): Promise<FederationPeer | null> {
  const result = await pool.query(
    `SELECT id, name, endpoint_url, public_key, trust_level, status, last_seen_at, registered_by, created_at
     FROM federation_peers WHERE endpoint_url = $1`,
    [endpointUrl],
  );
  return result.rows.length > 0 ? mapPeerRow(result.rows[0]) : null;
}

export async function updatePeerStatus(pool: Pool, peerId: string, status: string): Promise<boolean> {
  const result = await pool.query(
    'UPDATE federation_peers SET status = $2 WHERE id = $1',
    [peerId, status],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateLastSeen(pool: Pool, peerId: string): Promise<void> {
  await pool.query(
    'UPDATE federation_peers SET last_seen_at = now() WHERE id = $1',
    [peerId],
  );
}

function mapPeerRow(row: Record<string, unknown>): FederationPeer {
  return {
    id: row.id as string,
    name: row.name as string,
    endpointUrl: row.endpoint_url as string,
    publicKey: row.public_key as string,
    trustLevel: row.trust_level as FederationPeer['trustLevel'],
    status: row.status as FederationPeer['status'],
    lastSeenAt: row.last_seen_at instanceof Date ? row.last_seen_at.toISOString() : null,
    registeredBy: row.registered_by as string,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at as string),
  };
}

// --- Transfers ---

export async function insertTransfer(pool: Pool, transfer: TransferRecord): Promise<void> {
  await pool.query(
    `INSERT INTO federation_transfers (id, peer_id, direction, document_id, document_title, signature, audit_proof_hash, status, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [transfer.id, transfer.peerId, transfer.direction, transfer.documentId,
     transfer.documentTitle, transfer.signature, transfer.auditProofHash,
     transfer.status, transfer.error],
  );
}

export async function updateTransferStatus(
  pool: Pool, transferId: string, status: string, error?: string,
): Promise<void> {
  await pool.query(
    'UPDATE federation_transfers SET status = $2, error = $3 WHERE id = $1',
    [transferId, status, error ?? null],
  );
}

export async function listTransfers(pool: Pool, peerId?: string, limit = 50): Promise<TransferRecord[]> {
  const sql = peerId
    ? `SELECT * FROM federation_transfers WHERE peer_id = $1 ORDER BY created_at DESC LIMIT $2`
    : `SELECT * FROM federation_transfers ORDER BY created_at DESC LIMIT $1`;
  const params = peerId ? [peerId, limit] : [limit];
  const result = await pool.query(sql, params);
  return result.rows.map(mapTransferRow);
}

function mapTransferRow(row: Record<string, unknown>): TransferRecord {
  return {
    id: row.id as string,
    peerId: row.peer_id as string,
    direction: row.direction as 'inbound' | 'outbound',
    documentId: row.document_id as string,
    documentTitle: (row.document_title as string) ?? null,
    signature: row.signature as string,
    auditProofHash: (row.audit_proof_hash as string) ?? null,
    status: row.status as TransferRecord['status'],
    error: (row.error as string) ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at as string),
  };
}
