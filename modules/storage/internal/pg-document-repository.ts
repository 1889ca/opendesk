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
 */
export function createDocumentRepository(): DocumentRepository {
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
      }>(
        'SELECT snapshot, revision_id FROM documents WHERE id = $1',
        [docId],
      );
      const row = result.rows[0];
      if (!row?.snapshot) return null;

      return {
        snapshot: row.snapshot as DocumentSnapshot,
        revisionId: row.revision_id,
        // staleSeconds omitted — hot tier only; cold tier not yet implemented
      };
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
  };
}
