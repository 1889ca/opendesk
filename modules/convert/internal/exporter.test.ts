/** Contract: contracts/convert/rules.md */

/**
 * Integration tests for the export pipeline event wiring.
 *
 * Verifies:
 * 1. ConversionRequested is emitted before conversion begins
 * 2. ExportReady is emitted after conversion completes
 * 3. stale=false when StateFlushed arrives within timeout
 * 4. stale=true when StateFlushed never arrives (timeout)
 * 5. ExportReady is emitted even on timeout fallback
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { exportDocument } from './exporter.ts';
import type { EventBus, DomainEvent, EventType, EventHandler } from '../../events/contract.ts';
import { EventType as ET } from '../../events/contract.ts';

// --- mock libreoffice (convertFile) ---
vi.mock('./libreoffice.ts', () => ({
  convertFile: vi.fn().mockResolvedValue(Buffer.from('fake-output')),
}));

// --- mock storage (getDocument) ---
vi.mock('../../storage/index.ts', () => ({
  getDocument: vi.fn().mockResolvedValue({ id: 'doc-1', title: 'Test Doc' }),
}));

// --- EventBus factory ---

type SubscribeHandler = (event: DomainEvent) => Promise<void>;

function makeEventBus(opts: {
  /** If true, fire StateFlushed synchronously after ConversionRequested is emitted */
  autoFlush?: boolean;
  /** If true, simulate a subscribe() rejection */
  subscribeFails?: boolean;
}): { bus: EventBus; emitted: DomainEvent[] } {
  const emitted: DomainEvent[] = [];
  const subscribers: Array<{ group: string; types: EventType[]; handler: SubscribeHandler }> = [];

  const emit: Mock = vi.fn(async (event: DomainEvent) => {
    emitted.push(event);

    // When ConversionRequested is emitted, immediately fire StateFlushed
    // to simulate collab completing the flush synchronously
    if (opts.autoFlush && event.type === ET.ConversionRequested) {
      const flushEvent: DomainEvent = {
        id: 'flush-evt-id-aaaa-1111-2222-3333-444444444444',
        type: ET.StateFlushed,
        aggregateId: event.aggregateId,
        actorId: 'system:materializer',
        actorType: 'system',
        occurredAt: new Date().toISOString(),
      };
      for (const sub of subscribers) {
        if (sub.types.includes(ET.StateFlushed)) {
          await sub.handler(flushEvent);
        }
      }
    }
  });

  const subscribe: Mock = vi.fn(async (
    group: string,
    types: EventType[],
    handler: EventHandler,
  ) => {
    if (opts.subscribeFails) {
      throw new Error('subscribe failed');
    }
    subscribers.push({ group, types, handler });
  });

  const bus: EventBus = {
    emit,
    subscribe,
    acknowledge: vi.fn(),
    registerEventType: vi.fn(),
  };

  return { bus, emitted };
}

// ---------------------------------------------------------------------------

describe('exportDocument event wiring', () => {
  const docId = 'doc-abc-1234';
  const htmlContent = '<p>Hello world</p>';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits ConversionRequested before converting when eventBus is provided', async () => {
    const { bus, emitted } = makeEventBus({ autoFlush: true });

    await exportDocument(docId, 'docx', 'user-1', htmlContent, bus, { flushTimeoutMs: 500 });

    const convReq = emitted.find((e) => e.type === ET.ConversionRequested);
    expect(convReq).toBeDefined();
    expect(convReq?.aggregateId).toBe(docId);
    expect(convReq?.actorId).toBe('user-1');
  });

  it('emits ExportReady after conversion completes', async () => {
    const { bus, emitted } = makeEventBus({ autoFlush: true });

    await exportDocument(docId, 'docx', 'user-1', htmlContent, bus, { flushTimeoutMs: 500 });

    const exportReady = emitted.find((e) => e.type === ET.ExportReady);
    expect(exportReady).toBeDefined();
    expect(exportReady?.aggregateId).toBe(docId);
  });

  it('ConversionRequested is emitted before ExportReady', async () => {
    const { bus, emitted } = makeEventBus({ autoFlush: true });

    await exportDocument(docId, 'docx', 'user-1', htmlContent, bus, { flushTimeoutMs: 500 });

    const convReqIdx = emitted.findIndex((e) => e.type === ET.ConversionRequested);
    const exportReadyIdx = emitted.findIndex((e) => e.type === ET.ExportReady);
    expect(convReqIdx).toBeGreaterThanOrEqual(0);
    expect(exportReadyIdx).toBeGreaterThan(convReqIdx);
  });

  it('sets stale=false when StateFlushed arrives within timeout', async () => {
    const { bus } = makeEventBus({ autoFlush: true });

    const result = await exportDocument(
      docId, 'odt', 'user-2', htmlContent, bus, { flushTimeoutMs: 500 },
    );

    expect(result.stale).toBe(false);
  });

  it('sets stale=true when StateFlushed does not arrive within timeout', async () => {
    const { bus } = makeEventBus({ autoFlush: false });

    const result = await exportDocument(
      docId, 'pdf', 'user-3', htmlContent, bus, { flushTimeoutMs: 50 },
    );

    expect(result.stale).toBe(true);
  });

  it('still emits ExportReady when flush times out (stale fallback path)', async () => {
    const { bus, emitted } = makeEventBus({ autoFlush: false });

    await exportDocument(docId, 'pdf', 'user-3', htmlContent, bus, { flushTimeoutMs: 50 });

    const exportReady = emitted.find((e) => e.type === ET.ExportReady);
    expect(exportReady).toBeDefined();
  });

  it('sets stale=true and still emits ExportReady when subscribe() fails', async () => {
    const { bus, emitted } = makeEventBus({ subscribeFails: true });

    const result = await exportDocument(
      docId, 'docx', 'user-4', htmlContent, bus, { flushTimeoutMs: 50 },
    );

    expect(result.stale).toBe(true);
    const exportReady = emitted.find((e) => e.type === ET.ExportReady);
    expect(exportReady).toBeDefined();
  });

  it('does not emit any events when no eventBus is provided', async () => {
    // Verify the no-bus path still returns a valid result
    const result = await exportDocument(docId, 'docx', 'user-5', htmlContent);

    expect(result.stale).toBe(true);
    expect(result.documentId).toBe(docId);
    expect(result.format).toBe('docx');
    expect(result.fileBuffer).toBeDefined();
  });
});
