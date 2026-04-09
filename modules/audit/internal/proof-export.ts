/** Contract: contracts/audit/rules.md */

import type { Pool } from 'pg';
import type { AuditEntry } from '../contract.ts';
import { computeHash, verifyHash } from './hmac-chain.ts';
import * as store from './audit-store.ts';

/**
 * A self-contained audit proof bundle that can be verified independently.
 * Contains the full HMAC chain for a document plus verification metadata.
 */
export interface AuditProof {
  /** Schema version for forward compatibility. */
  version: 1;
  /** When this proof was generated. */
  exportedAt: string;
  /** The document this proof covers. */
  documentId: string;
  /** Total number of entries in the chain. */
  totalEntries: number;
  /** Hash of the first entry (chain anchor). */
  anchorHash: string;
  /** Hash of the last entry (chain head). */
  headHash: string;
  /** The full ordered chain of audit entries. */
  chain: AuditEntry[];
  /** Whether the chain was verified at export time. */
  verifiedAtExport: boolean;
}

/**
 * A lightweight proof summary without the full chain.
 * Useful for quick integrity checks.
 */
export interface AuditProofSummary {
  documentId: string;
  totalEntries: number;
  anchorHash: string;
  headHash: string;
  verified: boolean;
  firstEvent: string;
  lastEvent: string;
  exportedAt: string;
}

/**
 * Export a full audit proof for a document.
 * Includes the complete HMAC chain and verification status.
 */
export async function exportAuditProof(
  pool: Pool,
  documentId: string,
  hmacSecret: string,
): Promise<AuditProof> {
  const chain = await store.getFullChain(pool, documentId);

  let verified = true;
  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];
    const expectedPrev = i === 0 ? null : chain[i - 1].hash;
    if (entry.previousHash !== expectedPrev || !verifyHash(entry, hmacSecret)) {
      verified = false;
      break;
    }
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    documentId,
    totalEntries: chain.length,
    anchorHash: chain.length > 0 ? chain[0].hash : '',
    headHash: chain.length > 0 ? chain[chain.length - 1].hash : '',
    chain,
    verifiedAtExport: verified,
  };
}

/**
 * Export a lightweight proof summary (no full chain).
 */
export async function exportAuditProofSummary(
  pool: Pool,
  documentId: string,
  hmacSecret: string,
): Promise<AuditProofSummary> {
  const chain = await store.getFullChain(pool, documentId);

  let verified = true;
  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];
    const expectedPrev = i === 0 ? null : chain[i - 1].hash;
    if (entry.previousHash !== expectedPrev || !verifyHash(entry, hmacSecret)) {
      verified = false;
      break;
    }
  }

  return {
    documentId,
    totalEntries: chain.length,
    anchorHash: chain.length > 0 ? chain[0].hash : '',
    headHash: chain.length > 0 ? chain[chain.length - 1].hash : '',
    verified,
    firstEvent: chain.length > 0 ? chain[0].occurredAt : '',
    lastEvent: chain.length > 0 ? chain[chain.length - 1].occurredAt : '',
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Verify an audit proof independently (no database access needed).
 * Given an HMAC secret and a proof bundle, recompute and verify all hashes.
 * This function can run offline — it only needs the proof and the secret.
 */
export function verifyAuditProof(
  proof: AuditProof,
  hmacSecret: string,
): { verified: boolean; brokenAtIndex: number | null; brokenAtId: string | null } {
  const { chain } = proof;

  if (chain.length === 0) {
    return { verified: true, brokenAtIndex: null, brokenAtId: null };
  }

  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];
    const expectedPrev = i === 0 ? null : chain[i - 1].hash;

    // Verify chain linkage
    if (entry.previousHash !== expectedPrev) {
      return { verified: false, brokenAtIndex: i, brokenAtId: entry.id };
    }

    // Verify HMAC
    const expectedHash = computeHash(
      {
        eventId: entry.eventId,
        documentId: entry.documentId,
        actorId: entry.actorId,
        action: entry.action,
        occurredAt: entry.occurredAt,
        previousHash: entry.previousHash,
      },
      hmacSecret,
    );

    if (expectedHash !== entry.hash) {
      return { verified: false, brokenAtIndex: i, brokenAtId: entry.id };
    }
  }

  return { verified: true, brokenAtIndex: null, brokenAtId: null };
}
