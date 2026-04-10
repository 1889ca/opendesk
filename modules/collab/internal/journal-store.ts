/** Contract: contracts/collab/rules.md */
import type { Pool } from 'pg';

export interface JournalEntry {
  id: number;
  update: Uint8Array;
}

export interface JournalStore {
  append(docId: string, update: Uint8Array): Promise<{ sequenceNumber: number }>;
  getPendingUpdates(docId: string): Promise<JournalEntry[]>;
  markMerged(ids: number[]): Promise<void>;
}

export function createJournalStore(pool: Pool): JournalStore {
  return {
    async append(docId, update) {
      const res = await pool.query<{ sequence_number: number }>(
        `INSERT INTO collab_journal (doc_id, update_binary, sequence_number)
         VALUES ($1, $2, nextval('collab_journal_id_seq'::regclass))
         RETURNING sequence_number`,
        [docId, Buffer.from(update)],
      );
      return { sequenceNumber: res.rows[0].sequence_number };
    },

    async getPendingUpdates(docId) {
      const res = await pool.query<{ id: number; update_binary: Buffer }>(
        `SELECT id, update_binary FROM collab_journal
         WHERE doc_id = $1 AND merged = FALSE ORDER BY id ASC`,
        [docId],
      );
      return res.rows.map((r) => ({ id: r.id, update: new Uint8Array(r.update_binary) }));
    },

    async markMerged(ids) {
      if (ids.length === 0) return;
      await pool.query(
        `UPDATE collab_journal SET merged = TRUE WHERE id = ANY($1)`,
        [ids],
      );
    },
  };
}
