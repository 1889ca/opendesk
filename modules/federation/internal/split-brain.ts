/** Contract: contracts/federation/rules.md */
import { randomUUID } from 'node:crypto';
import * as Y from 'yjs';
import {
  SplitBrainEventSchema,
  type SplitBrainEvent,
  type SplitBrainType,
} from '../contract.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('federation:split-brain');

/** Storage interface for split-brain events. */
export interface SplitBrainStore {
  save(event: SplitBrainEvent): Promise<void>;
  findByDocument(documentId: string): Promise<SplitBrainEvent[]>;
  findPending(documentId: string): Promise<SplitBrainEvent[]>;
  resolve(id: string, resolution: 'auto_merged' | 'manual'): Promise<void>;
}

export function createInMemorySplitBrainStore(): SplitBrainStore {
  const events = new Map<string, SplitBrainEvent>();

  return {
    async save(event) {
      SplitBrainEventSchema.parse(event);
      events.set(event.id, event);
    },
    async findByDocument(documentId) {
      return [...events.values()].filter((e) => e.documentId === documentId);
    },
    async findPending(documentId) {
      return [...events.values()].filter(
        (e) => e.documentId === documentId && e.resolution === 'pending',
      );
    },
    async resolve(id, resolution) {
      const event = events.get(id);
      if (event) {
        events.set(id, { ...event, resolution, resolvedAt: new Date().toISOString() });
      }
    },
  };
}

/**
 * Detect a split-brain for Yjs document content on reconnect.
 * Yjs CRDTs handle the merge automatically, but we log the event.
 * Returns the merged document state.
 */
export async function detectContentSplitBrain(
  store: SplitBrainStore,
  documentId: string,
  localState: Uint8Array,
  remoteState: Uint8Array,
  localInstanceId: string,
  remoteInstanceId: string,
): Promise<{ merged: Uint8Array; event: SplitBrainEvent }> {
  // Check if states actually differ
  const localDoc = new Y.Doc();
  Y.applyUpdate(localDoc, localState);
  const remoteDoc = new Y.Doc();
  Y.applyUpdate(remoteDoc, remoteState);

  // Merge: apply remote state to local doc (Yjs CRDT handles conflicts)
  const remoteUpdate = Y.encodeStateAsUpdate(remoteDoc, Y.encodeStateVector(localDoc));
  Y.applyUpdate(localDoc, remoteUpdate);
  const merged = Y.encodeStateAsUpdate(localDoc);

  const event: SplitBrainEvent = {
    id: randomUUID(),
    documentId,
    type: 'content',
    localInstanceId,
    remoteInstanceId,
    detectedAt: new Date().toISOString(),
    resolvedAt: new Date().toISOString(),
    resolution: 'auto_merged',
  };

  await store.save(event);
  log.info('content split-brain auto-merged', { documentId, localInstanceId, remoteInstanceId });

  localDoc.destroy();
  remoteDoc.destroy();

  return { merged, event };
}

/**
 * Detect a metadata split-brain (title, tags, permissions).
 * These cannot be auto-merged -- they require manual resolution.
 */
export async function detectMetadataSplitBrain(
  store: SplitBrainStore,
  documentId: string,
  localInstanceId: string,
  remoteInstanceId: string,
  localMeta: Record<string, unknown>,
  remoteMeta: Record<string, unknown>,
): Promise<SplitBrainEvent | null> {
  // Compare metadata fields
  const hasConflict = Object.keys({ ...localMeta, ...remoteMeta }).some(
    (key) => JSON.stringify(localMeta[key]) !== JSON.stringify(remoteMeta[key]),
  );

  if (!hasConflict) return null;

  const event: SplitBrainEvent = {
    id: randomUUID(),
    documentId,
    type: 'metadata',
    localInstanceId,
    remoteInstanceId,
    detectedAt: new Date().toISOString(),
    resolution: 'pending',
  };

  await store.save(event);
  log.info('metadata split-brain detected', { documentId, fields: Object.keys(localMeta) });

  return event;
}

/**
 * Detect a KB entry split-brain.
 * KB conflicts are flagged as diverged and require manual resolution.
 */
export async function detectKBSplitBrain(
  store: SplitBrainStore,
  documentId: string,
  localInstanceId: string,
  remoteInstanceId: string,
): Promise<SplitBrainEvent> {
  const event: SplitBrainEvent = {
    id: randomUUID(),
    documentId,
    type: 'kb_entry',
    localInstanceId,
    remoteInstanceId,
    detectedAt: new Date().toISOString(),
    resolution: 'pending',
  };

  await store.save(event);
  log.info('KB entry split-brain detected', { documentId });

  return event;
}

/**
 * Resolve a pending split-brain event manually.
 */
export async function resolveSplitBrain(
  store: SplitBrainStore,
  eventId: string,
): Promise<void> {
  await store.resolve(eventId, 'manual');
  log.info('split-brain manually resolved', { eventId });
}
