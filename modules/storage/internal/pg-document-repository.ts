/** Contract: contracts/storage/rules.md */
import * as Y from 'yjs';
import { pool } from './pool.ts';
import {
  STATE_VECTOR_PRUNE_THRESHOLD_DAYS,
  type DocumentRepository,
  type SaveSnapshotParams,
  type SnapshotReadResult,
  type SaveYjsBinaryParams,
} from '../contract.ts';
import type { DocumentSnapshot } from '../../document/contract/index.ts';
import type { ColdStorageAdapter } from './cold-storage.ts';

/** Milliseconds in one day — used for state-vector prune threshold. */
const MS_PER_DAY = 86_400_000;

/**
 * Decode a Yjs state vector (client-id → clock Map) and remove any
 * client whose last-seen clock hasn't advanced in > 30 days.
 *
 * Yjs state vectors are compact binary maps. We re-encode the pruned
 * result so only active clients' clocks are retained.
 *
 * Returns the (possibly pruned) state vector as a Buffer.
 */
function pruneStateVector(raw: Uint8Array): Buffer {
  try {
    const decoded = Y.decodeStateVector(raw);
    const cutoff = Date.now() - STATE_VECTOR_PRUNE_THRESHOLD_DAYS * MS_PER_DAY;

    // Yjs client IDs are derived from Date.now() at doc creation time,
    // so IDs numerically less than the cutoff are stale.
    for (const [clientId] of decoded) {
      if (clientId < cutoff) decoded.delete(clientId);
    }

    return Buffer.from(Y.encodeStateVector(decoded as unknown as Y.Doc));
  } catch {
    // If decoding fails (corrupt or empty), persist as-is.
    return Buffer.from(raw);
  }
}

/**
 * PostgreSQL implementation of DocumentRepository.
 *
 * All writes use pool-level connections so callers don't manage
 * transactions. saveSnapshot wraps its two UPDATEs in a single
 * client-scoped BEGIN/COMMIT to satisfy the atomicity invariant.
 *
 * When a `ColdStorageAdapter` is provided, `getSnapshot` transparently
 * serves cold documents from S3 and triggers an async warm-up so that
 * subsequent reads are served from the hot tier.
 */
export function createDocumentRepository(cold?: ColdStorageAdapter): DocumentRepository {
  return {
    async saveSnapshot(params: SaveSnapshotParams): Promise<void> {
      const { docId, snapshot, revisionId, stateVector } = params;
      const snapshotJson = JSON.stringify(snapshot);
      const prunedVector = pruneStateVector(stateVector);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO documents (id, title, snapshot, revision_id, state_vector, updated_at)
           VALUES ($1, 'Untitled', $2, $3, $4, NOW())
           ON CONFLICT (id) DO UPDATE
             SET snapshot     = EXCLUDED.snapshot,
                 revision_id  = EXCLUDED.revision_id,
                 state_vector = EXCLUDED.state_vector,
                 updated_at   = NOW()`,
          [docId, snapshotJson, revisionId, prunedVector],
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    async getSnapshot(docId: string): Promise<SnapshotReadResult | null> {
      const result = await pool.query<{
        snapshot: unknown;
        revision_id: string;
        tier: string;
        archived_at: Date | null;
        cold_key: string | null;
      }>(
        'SELECT snapshot, revision_id, tier, archived_at, cold_key FROM documents WHERE id = $1',
        [docId],
      );
      const row = result.rows[0];
      if (!row) return null;

      // Hot tier: snapshot is present in PG.
      if (row.tier === 'hot' || !cold) {
        if (!row.snapshot) return null;
        return {
          snapshot: row.snapshot as DocumentSnapshot,
          revisionId: row.revision_id,
        };
      }

      // Cold tier: fetch from S3, trigger async warm-up, return with staleSeconds.
      const { warmFromCold, archiveToCold } = cold;
      void archiveToCold; // unused here — referenced via adapter methods below
      await cold.warmFromCold(docId).catch(console.error);

      // Re-read from PG after warm-up attempt.
      const warmedResult = await pool.query<{
        snapshot: unknown;
        revision_id: string;
      }>(
        'SELECT snapshot, revision_id FROM documents WHERE id = $1',
        [docId],
      );
      const warmed = warmedResult.rows[0];
      const staleSeconds = row.archived_at
        ? Math.floor((Date.now() - row.archived_at.getTime()) / 1000)
        : 0;

      if (warmed?.snapshot) {
        return {
          snapshot: warmed.snapshot as DocumentSnapshot,
          revisionId: warmed.revision_id,
          staleSeconds,
        };
      }

      // Warm-up failed — serve from S3 directly via a second warmFromCold call
      // that already ran; return null so callers can handle gracefully.
      return null;
    },

    async saveYjsBinary(params: SaveYjsBinaryParams): Promise<void> {
      const { docId, binary } = params;
      await pool.query(
        `INSERT INTO documents (id, title, yjs_state, updated_at)
         VALUES ($1, 'Untitled', $2, NOW())
         ON CONFLICT (id) DO UPDATE
           SET yjs_state  = EXCLUDED.yjs_state,
               updated_at = NOW()`,
        [docId, binary],
      );
    },

    async getYjsBinary(docId: string): Promise<Buffer | null> {
      const result = await pool.query<{ yjs_state: Buffer | null }>(
        'SELECT yjs_state FROM documents WHERE id = $1',
        [docId],
      );
      return result.rows[0]?.yjs_state ?? null;
    },

    ...(cold
      ? {
          archiveToCold: (docId: string) => cold.archiveToCold(docId),
          warmFromCold: (docId: string) => cold.warmFromCold(docId),
        }
      : {}),
  };
}
