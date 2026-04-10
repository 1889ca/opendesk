/** Contract: contracts/collab/rules.md */
/**
 * Crash-recovery integration tests.
 *
 * Simulates the sequence:
 *   1. Document is loaded and a base snapshot saved to storage.
 *   2. Updates arrive and are journaled (but no new snapshot is saved —
 *      simulating a crash before the materializer fired).
 *   3. Document is loaded again: base snapshot + pending journal entries
 *      must be replayed so all updates are visible.
 *
 * No Hocuspocus involved — we exercise the journal and Yjs APIs directly,
 * mirroring exactly what server.ts does in onLoadDocument / onChange.
 */
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { createJournalStore } from './journal-store.ts';

// ---------------------------------------------------------------------------
// In-memory storage (base Yjs snapshot) + pool (journal)
// ---------------------------------------------------------------------------

function createMemoryStorage(): {
  save(docId: string, state: Uint8Array): void;
  load(docId: string): Uint8Array | null;
} {
  const store = new Map<string, Uint8Array>();
  return {
    save(docId, state) { store.set(docId, state); },
    load(docId) { return store.get(docId) ?? null; },
  };
}

interface FakeRow {
  id: number;
  doc_id: string;
  update_binary: Buffer;
  merged: boolean;
}

function createFakePool() {
  const rows: FakeRow[] = [];
  let nextId = 1;

  const pool = {
    async query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> {
      const s = sql.trim().toUpperCase();

      if (s.startsWith('INSERT')) {
        const row: FakeRow = {
          id: nextId++,
          doc_id: params![0] as string,
          update_binary: params![1] as Buffer,
          merged: false,
        };
        rows.push(row);
        return { rows: [{ sequence_number: row.id }] };
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

  return { pool: pool as never };
}

// ---------------------------------------------------------------------------
// Helpers that mirror what server.ts does
// ---------------------------------------------------------------------------

/**
 * Simulate saving a Yjs state snapshot (like onStoreDocument or materializer).
 */
function saveSnapshot(storage: ReturnType<typeof createMemoryStorage>, docId: string, doc: Y.Doc) {
  storage.save(docId, Y.encodeStateAsUpdate(doc));
}

/**
 * Simulate loading a document: apply base snapshot, then replay journal.
 */
async function loadDocument(
  storage: ReturnType<typeof createMemoryStorage>,
  journal: ReturnType<typeof createJournalStore>,
  docId: string,
): Promise<Y.Doc> {
  const doc = new Y.Doc();

  const base = storage.load(docId);
  if (base) {
    Y.applyUpdate(doc, base);
  }

  const pending = await journal.getPendingUpdates(docId);
  for (const entry of pending) {
    Y.applyUpdate(doc, entry.update);
  }
  if (pending.length > 0) {
    await journal.markMerged(pending.map((e) => e.id));
  }

  return doc;
}

/**
 * Simulate onChange: capture the Yjs update binary and append to journal.
 * Returns the Yjs update that was produced so caller can also apply it.
 */
function captureUpdate(doc: Y.Doc, mutate: (doc: Y.Doc) => void): Uint8Array {
  let captured: Uint8Array | null = null;
  const off = doc.on('update', (update: Uint8Array) => { captured = update; });
  mutate(doc);
  doc.off('update', off);
  if (!captured) throw new Error('no update produced');
  return captured;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Crash recovery – journal replay', () => {
  it('recovers updates journaled after last snapshot', async () => {
    const storage = createMemoryStorage();
    const { pool } = createFakePool();
    const journal = createJournalStore(pool);
    const DOC = 'doc-crash-1';

    // --- Phase 1: initial load + snapshot save ---
    const doc1 = new Y.Doc();
    doc1.getText('content').insert(0, 'hello');
    saveSnapshot(storage, DOC, doc1);

    // --- Phase 2: more edits arrive, journaled but NO new snapshot ---
    const update1 = captureUpdate(doc1, (d) => d.getText('content').insert(5, ' world'));
    await journal.append(DOC, update1);

    const update2 = captureUpdate(doc1, (d) => d.getText('content').insert(11, '!'));
    await journal.append(DOC, update2);

    // Simulate crash — doc1 is gone from memory.

    // --- Phase 3: recovery load ---
    const doc2 = await loadDocument(storage, journal, DOC);

    expect(doc2.getText('content').toString()).toBe('hello world!');
  });

  it('has no pending journal entries after recovery (entries marked merged)', async () => {
    const storage = createMemoryStorage();
    const { pool } = createFakePool();
    const journal = createJournalStore(pool);
    const DOC = 'doc-crash-2';

    const doc1 = new Y.Doc();
    saveSnapshot(storage, DOC, doc1);

    const update = captureUpdate(doc1, (d) => d.getText('x').insert(0, 'abc'));
    await journal.append(DOC, update);

    await loadDocument(storage, journal, DOC);

    const remaining = await journal.getPendingUpdates(DOC);
    expect(remaining).toHaveLength(0);
  });

  it('recovers correctly when there is no base snapshot (fresh document)', async () => {
    const storage = createMemoryStorage(); // empty
    const { pool } = createFakePool();
    const journal = createJournalStore(pool);
    const DOC = 'doc-crash-3';

    // Edits arrive before any snapshot was ever saved
    const doc1 = new Y.Doc();
    const update = captureUpdate(doc1, (d) => d.getText('content').insert(0, 'brand new'));
    await journal.append(DOC, update);

    const doc2 = await loadDocument(storage, journal, DOC);
    expect(doc2.getText('content').toString()).toBe('brand new');
  });

  it('is idempotent: applying same update twice does not corrupt CRDT state', async () => {
    const storage = createMemoryStorage();
    const { pool } = createFakePool();
    const journal = createJournalStore(pool);
    const DOC = 'doc-crash-4';

    const doc1 = new Y.Doc();
    saveSnapshot(storage, DOC, doc1);

    const update = captureUpdate(doc1, (d) => d.getText('content').insert(0, 'idempotent'));
    await journal.append(DOC, update);

    const doc2 = await loadDocument(storage, journal, DOC);

    // Apply the same update once more — Yjs CRDTs are idempotent
    Y.applyUpdate(doc2, update);

    expect(doc2.getText('content').toString()).toBe('idempotent');
  });
});
