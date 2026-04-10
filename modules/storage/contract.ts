/** Contract: contracts/storage/rules.md */
import { z } from 'zod';
import type { DocumentSnapshot, RevisionId } from '../document/contract/index.ts';

// --- Storage Tier ---

export const StorageTier = {
  Hot: 'hot',
  Cold: 'cold',
} as const;

export type StorageTier = (typeof StorageTier)[keyof typeof StorageTier];

export const StorageTierSchema = z.enum(['hot', 'cold']);

// --- Snapshot Read Result ---

export const SnapshotReadResultSchema = z.object({
  snapshot: z.unknown(),
  revisionId: z.string(),
  staleSeconds: z.number().nonnegative().optional(),
});

export type SnapshotReadResult = {
  snapshot: DocumentSnapshot;
  revisionId: RevisionId;
  /** Present only when served from cold storage. Seconds since archival. */
  staleSeconds?: number;
};

// --- Save Snapshot Params ---

export const SaveSnapshotParamsSchema = z.object({
  docId: z.string().min(1),
  snapshot: z.unknown(),
  revisionId: z.string(),
  stateVector: z.instanceof(Uint8Array),
});

export type SaveSnapshotParams = {
  docId: string;
  snapshot: DocumentSnapshot;
  revisionId: RevisionId;
  /** Co-persisted atomically with the snapshot. */
  stateVector: Uint8Array;
};

// --- Yjs Binary Params ---

export const SaveYjsBinaryParamsSchema = z.object({
  docId: z.string().min(1),
  binary: z.instanceof(Buffer),
});

export type SaveYjsBinaryParams = {
  docId: string;
  binary: Buffer;
};

// --- State Vector Pruning ---

/** Maximum offline duration before a client's state vector entry is pruned. */
export const STATE_VECTOR_PRUNE_THRESHOLD_DAYS = 30;

// --- Document Repository Interface ---

/**
 * Abstract persistence interface for document storage.
 *
 * Implementations handle hot/cold tiering internally.
 * Callers never specify or know which tier holds a document.
 *
 * Invariants:
 * - saveSnapshot co-persists snapshot + state vector atomically
 * - State vector entries for clients offline > 30 days are pruned on write
 * - getSnapshot returns data regardless of tier; staleSeconds indicates cold
 * - Yjs binary and DocumentSnapshot are stored at separate paths
 */
export interface DocumentRepository {
  /** Atomically persist a snapshot and its state vector. */
  saveSnapshot(params: SaveSnapshotParams): Promise<void>;

  /** Retrieve the latest snapshot for a document, from any tier. */
  getSnapshot(docId: string): Promise<SnapshotReadResult | null>;

  /** Store the raw Yjs CRDT binary blob (separate from snapshot). */
  saveYjsBinary(params: SaveYjsBinaryParams): Promise<void>;

  /** Retrieve the raw Yjs binary for a document. */
  getYjsBinary(docId: string): Promise<Buffer | null>;

  /**
   * Move document data from PostgreSQL hot tier to S3 cold tier.
   * Optional: only present when the repository is wired with a ColdStorageAdapter.
   */
  archiveToCold?(docId: string): Promise<void>;

  /**
   * Restore document data from S3 cold tier back to PostgreSQL hot tier.
   * Optional: only present when the repository is wired with a ColdStorageAdapter.
   */
  warmFromCold?(docId: string): Promise<void>;
}
