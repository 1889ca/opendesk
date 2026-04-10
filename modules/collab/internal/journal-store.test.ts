/** Contract: contracts/collab/rules.md */
import { describe, it, expect, beforeEach } from 'vitest';
import { createJournalStore, type JournalStore } from './journal-store.ts';

// ---------------------------------------------------------------------------
// In-memory Pool stub — stores rows in a plain Map.
// ---------------------------------------------------------------------------

interface JournalRow {
  id: number;
  doc_id: string;
  update_binary: Buffer;
  sequence_number: number;
  merged: boolean;
}

function createFakePool(): { pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }; rows: JournalRow[] } {
  const rows: JournalRow[] = [];
  let nextId = 1;

  const pool = {
    async query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> {
      const s = sql.trim().toUpperCase();

      if (s.startsWith('INSERT')) {
        const docId = params![0] as string;
        const updateBin = params![1] as Buffer;
        const id = nextId++;
        const row: JournalRow = {
          id,
          doc_id: docId,
          update_binary: updateBin,
          sequence_number: id,
          merged: false,
        };
        rows.push(row);
        return { rows: [{ sequence_number: row.sequence_number }] };
      }

      if (s.startsWith('SELECT')) {
        const docId = params![0] as string;
        const pending = rows
          .filter((r) => r.doc_id === docId && !r.merged)
          .sort((a, b) => a.id - b.id);
        return { rows: pending.map((r) => ({ id: r.id, update_binary: r.update_binary })) };
      }

      if (s.startsWith('UPDATE')) {
        const ids = params![0] as number[];
        for (const row of rows) {
          if (ids.includes(row.id)) row.merged = true;
        }
        return { rows: [] };
      }

      return { rows: [] };
    },
  };

  return { pool: pool as never, rows };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JournalStore – append', () => {
  it('stores a binary update and returns a sequenceNumber', async () => {
    const { pool } = createFakePool();
    const store: JournalStore = createJournalStore(pool as never);

    const update = new Uint8Array([1, 2, 3, 4]);
    const result = await store.append('doc-1', update);

    expect(typeof result.sequenceNumber).toBe('number');
    expect(result.sequenceNumber).toBeGreaterThan(0);
  });

  it('each append produces an incrementing sequenceNumber', async () => {
    const { pool } = createFakePool();
    const store = createJournalStore(pool as never);

    const r1 = await store.append('doc-1', new Uint8Array([1]));
    const r2 = await store.append('doc-1', new Uint8Array([2]));

    expect(r2.sequenceNumber).toBeGreaterThan(r1.sequenceNumber);
  });
});

describe('JournalStore – getPendingUpdates', () => {
  it('returns only unmerged entries in ascending id order', async () => {
    const { pool } = createFakePool();
    const store = createJournalStore(pool as never);

    await store.append('doc-1', new Uint8Array([10]));
    await store.append('doc-1', new Uint8Array([20]));
    await store.append('doc-1', new Uint8Array([30]));

    const pending = await store.getPendingUpdates('doc-1');

    expect(pending).toHaveLength(3);
    expect(pending[0].update[0]).toBe(10);
    expect(pending[1].update[0]).toBe(20);
    expect(pending[2].update[0]).toBe(30);
  });

  it('returns Uint8Array instances', async () => {
    const { pool } = createFakePool();
    const store = createJournalStore(pool as never);

    await store.append('doc-1', new Uint8Array([42]));
    const pending = await store.getPendingUpdates('doc-1');

    expect(pending[0].update).toBeInstanceOf(Uint8Array);
  });

  it('returns empty array when there are no pending entries', async () => {
    const { pool } = createFakePool();
    const store = createJournalStore(pool as never);

    const pending = await store.getPendingUpdates('doc-nobody');
    expect(pending).toHaveLength(0);
  });

  it('isolates entries by docId', async () => {
    const { pool } = createFakePool();
    const store = createJournalStore(pool as never);

    await store.append('doc-a', new Uint8Array([1]));
    await store.append('doc-b', new Uint8Array([2]));

    const pendingA = await store.getPendingUpdates('doc-a');
    const pendingB = await store.getPendingUpdates('doc-b');

    expect(pendingA).toHaveLength(1);
    expect(pendingB).toHaveLength(1);
    expect(pendingA[0].update[0]).toBe(1);
    expect(pendingB[0].update[0]).toBe(2);
  });
});

describe('JournalStore – markMerged', () => {
  it('marks entries so they no longer appear in getPendingUpdates', async () => {
    const { pool } = createFakePool();
    const store = createJournalStore(pool as never);

    await store.append('doc-1', new Uint8Array([1]));
    await store.append('doc-1', new Uint8Array([2]));

    const before = await store.getPendingUpdates('doc-1');
    const ids = before.map((e) => e.id);

    await store.markMerged(ids);

    const after = await store.getPendingUpdates('doc-1');
    expect(after).toHaveLength(0);
  });

  it('only marks the specified ids — others remain pending', async () => {
    const { pool } = createFakePool();
    const store = createJournalStore(pool as never);

    await store.append('doc-1', new Uint8Array([1]));
    await store.append('doc-1', new Uint8Array([2]));
    await store.append('doc-1', new Uint8Array([3]));

    const all = await store.getPendingUpdates('doc-1');
    // Only mark the first two
    await store.markMerged([all[0].id, all[1].id]);

    const remaining = await store.getPendingUpdates('doc-1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].update[0]).toBe(3);
  });

  it('is a no-op when called with an empty array', async () => {
    const { pool } = createFakePool();
    const store = createJournalStore(pool as never);

    await store.append('doc-1', new Uint8Array([99]));
    await expect(store.markMerged([])).resolves.not.toThrow();

    const pending = await store.getPendingUpdates('doc-1');
    expect(pending).toHaveLength(1);
  });
});
