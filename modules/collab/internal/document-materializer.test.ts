/** Contract: contracts/collab/rules.md */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import {
  createDocumentMaterializer,
  computeRevisionId,
} from './document-materializer.ts';
import type { DocumentRepository, SaveSnapshotParams } from '../../storage/contract.ts';
import type { EventBus, DomainEvent } from '../../events/index.ts';
import { EventType } from '../../events/index.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDoc(): Y.Doc {
  return new Y.Doc();
}

function createFakeRepo(): {
  repo: DocumentRepository;
  savedParams: SaveSnapshotParams[];
} {
  const savedParams: SaveSnapshotParams[] = [];

  const repo: DocumentRepository = {
    async saveSnapshot(params) {
      savedParams.push(params);
    },
    async getSnapshot() {
      return null;
    },
    async saveYjsBinary() {},
    async getYjsBinary() {
      return null;
    },
  };

  return { repo, savedParams };
}

function createFakeEventBus(): {
  eventBus: EventBus;
  emittedEvents: DomainEvent[];
} {
  const emittedEvents: DomainEvent[] = [];

  const eventBus: EventBus = {
    async emit(event) {
      emittedEvents.push(event);
    },
    async subscribe() {},
    async acknowledge() {},
    async registerEventType() {},
  };

  return { eventBus, emittedEvents };
}

// ---------------------------------------------------------------------------
// computeRevisionId
// ---------------------------------------------------------------------------

describe('computeRevisionId', () => {
  it('returns a 64-char lowercase hex string (SHA-256)', () => {
    const sv = Y.encodeStateVector(makeDoc());
    const id = computeRevisionId(sv);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same state vector', () => {
    const doc = makeDoc();
    const sv = Y.encodeStateVector(doc);
    expect(computeRevisionId(sv)).toBe(computeRevisionId(sv));
  });

  it('produces different IDs for different state vectors', () => {
    const doc1 = makeDoc();
    const doc2 = makeDoc();
    // Mutate doc2 so its state vector differs
    doc2.getText('x').insert(0, 'hello');

    const id1 = computeRevisionId(Y.encodeStateVector(doc1));
    const id2 = computeRevisionId(Y.encodeStateVector(doc2));
    expect(id1).not.toBe(id2);
  });
});

// ---------------------------------------------------------------------------
// flush
// ---------------------------------------------------------------------------

describe('createDocumentMaterializer – flush', () => {
  it('calls repo.saveSnapshot with correct docId, revisionId, and stateVector', async () => {
    const { repo, savedParams } = createFakeRepo();
    const mat = createDocumentMaterializer({ repo });
    const doc = makeDoc();

    await mat.flush('doc-abc', doc);

    expect(savedParams).toHaveLength(1);
    const p = savedParams[0];
    expect(p.docId).toBe('doc-abc');
    expect(p.revisionId).toMatch(/^[0-9a-f]{64}$/);
    expect(p.stateVector).toBeInstanceOf(Uint8Array);
  });

  it('produces a TextDocumentSnapshot with documentType=text', async () => {
    const { repo, savedParams } = createFakeRepo();
    const mat = createDocumentMaterializer({ repo });

    await mat.flush('doc-text', makeDoc());

    const snap = savedParams[0].snapshot as { documentType: string };
    expect(snap.documentType).toBe('text');
  });

  it('emits DocumentUpdated and StateFlushed events when eventBus provided', async () => {
    const { repo } = createFakeRepo();
    const { eventBus, emittedEvents } = createFakeEventBus();
    const mat = createDocumentMaterializer({ repo, eventBus });

    await mat.flush('doc-events', makeDoc());

    const types = emittedEvents.map((e) => e.type);
    expect(types).toContain(EventType.DocumentUpdated);
    expect(types).toContain(EventType.StateFlushed);
  });

  it('emitted events carry matching aggregateId and revisionId', async () => {
    const { repo, savedParams } = createFakeRepo();
    const { eventBus, emittedEvents } = createFakeEventBus();
    const mat = createDocumentMaterializer({ repo, eventBus });

    await mat.flush('doc-check', makeDoc());

    const revisionId = savedParams[0].revisionId;
    for (const event of emittedEvents) {
      expect(event.aggregateId).toBe('doc-check');
      expect(event.revisionId).toBe(revisionId);
    }
  });

  it('does not throw when eventBus is omitted', async () => {
    const { repo } = createFakeRepo();
    const mat = createDocumentMaterializer({ repo });
    await expect(mat.flush('doc-no-bus', makeDoc())).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// schedule (debouncing)
// ---------------------------------------------------------------------------

describe('createDocumentMaterializer – schedule debouncing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not flush before the debounce window elapses', async () => {
    const { repo, savedParams } = createFakeRepo();
    const mat = createDocumentMaterializer({ repo, debounceMs: 500 });
    const doc = makeDoc();

    mat.schedule('doc-1', doc);

    // Advance time to just before the debounce fires
    await vi.advanceTimersByTimeAsync(499);
    expect(savedParams).toHaveLength(0);
  });

  it('flushes after the debounce window elapses', async () => {
    const { repo, savedParams } = createFakeRepo();
    const mat = createDocumentMaterializer({ repo, debounceMs: 500 });
    const doc = makeDoc();

    mat.schedule('doc-2', doc);
    await vi.advanceTimersByTimeAsync(500);

    expect(savedParams).toHaveLength(1);
  });

  it('multiple schedules within the window only trigger one flush', async () => {
    const { repo, savedParams } = createFakeRepo();
    const mat = createDocumentMaterializer({ repo, debounceMs: 500 });
    const doc = makeDoc();

    mat.schedule('doc-3', doc);
    await vi.advanceTimersByTimeAsync(200);
    mat.schedule('doc-3', doc);
    await vi.advanceTimersByTimeAsync(200);
    mat.schedule('doc-3', doc);
    await vi.advanceTimersByTimeAsync(500);

    expect(savedParams).toHaveLength(1);
  });

  it('schedules for different docIds are independent', async () => {
    const { repo, savedParams } = createFakeRepo();
    const mat = createDocumentMaterializer({ repo, debounceMs: 200 });

    mat.schedule('doc-a', makeDoc());
    mat.schedule('doc-b', makeDoc());
    await vi.advanceTimersByTimeAsync(200);

    expect(savedParams).toHaveLength(2);
    const docIds = savedParams.map((p) => p.docId);
    expect(docIds).toContain('doc-a');
    expect(docIds).toContain('doc-b');
  });
});
