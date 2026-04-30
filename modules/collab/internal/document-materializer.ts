/** Contract: contracts/collab/rules.md */
import * as Y from 'yjs';
import { randomUUID } from 'node:crypto';
import { computeRevisionId } from '../../document/internal/revision.ts';
export { computeRevisionId };
import type { DocumentRepository } from '../../storage/contract.ts';
import { EventType, type EventBus } from '../../events/index.ts';
import type { TextDocumentSnapshot, ProseMirrorNode } from '../../document/contract/index.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('collab:materializer');

// ---------------------------------------------------------------------------
// Yjs → ProseMirror JSON conversion
// ---------------------------------------------------------------------------

/**
 * Recursively converts a Y.XmlElement or Y.XmlText to a ProseMirrorNode.
 * TipTap stores document state in a 'default' Y.XmlFragment whose children
 * are Y.XmlElement nodes corresponding to ProseMirror block nodes.
 *
 * Y.XmlFragment and Y.XmlElement are not directly iterable — use toArray().
 */
function xmlNodeToProseMirror(node: Y.XmlElement | Y.XmlText): ProseMirrorNode | null {
  if (node instanceof Y.XmlText) {
    const text = node.toString();
    if (text === '') return null;
    return { type: 'text', text };
  }

  const type = node.nodeName;
  if (!type) return null;

  const attrs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(node.getAttributes())) {
    attrs[key] = val;
  }

  const children: ProseMirrorNode[] = [];
  // Y.XmlElement.toArray() returns the children as an array
  for (const child of (node as unknown as { toArray(): unknown[] }).toArray()) {
    const converted = xmlNodeToProseMirror(child as Y.XmlElement | Y.XmlText);
    if (converted !== null) children.push(converted);
  }

  const result: ProseMirrorNode = { type };
  if (Object.keys(attrs).length > 0) result.attrs = attrs;
  if (children.length > 0) result.content = children;

  return result;
}

/**
 * Converts a Y.Doc (TipTap/ProseMirror CRDT state) into a TextDocumentSnapshot.
 *
 * TipTap stores document content in a Y.XmlFragment named 'default'.
 * Each child element corresponds to a ProseMirror block node.
 * Y.XmlFragment.toArray() returns child nodes as an array.
 */
function yDocToSnapshot(ydoc: Y.Doc): TextDocumentSnapshot {
  const fragment = ydoc.getXmlFragment('default');
  const content: ProseMirrorNode[] = [];

  for (const child of fragment.toArray()) {
    const node = xmlNodeToProseMirror(child as Y.XmlElement | Y.XmlText);
    if (node !== null) content.push(node);
  }

  return {
    documentType: 'text',
    schemaVersion: '1.0.0',
    content: {
      type: 'doc',
      content,
    },
  };
}

// ---------------------------------------------------------------------------
// Materializer
// ---------------------------------------------------------------------------

export interface MaterializerOptions {
  repo: DocumentRepository;
  eventBus?: EventBus;
  debounceMs?: number;
}

export interface DocumentMaterializer {
  /** Schedule a debounced flush for the given document. */
  schedule(docId: string, ydoc: Y.Doc): void;
  /** Immediately flush a document (bypasses debounce). */
  flush(docId: string, ydoc: Y.Doc): Promise<void>;
}

/**
 * Creates a Document Materializer that converts live Yjs CRDT state into
 * a typed DocumentSnapshot, persists it, and emits domain events.
 *
 * The materializer debounces flush calls so rapid edits don't hammer the
 * database — only the final state within each debounce window is persisted.
 */
export function createDocumentMaterializer(opts: MaterializerOptions): DocumentMaterializer {
  const { repo, eventBus, debounceMs = 2000 } = opts;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function schedule(docId: string, ydoc: Y.Doc): void {
    const existing = timers.get(docId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      timers.delete(docId);
      flush(docId, ydoc).catch((err) => {
        log.error('debounced flush failed', { docId, error: String(err) });
      });
    }, debounceMs);

    timers.set(docId, timer);
  }

  async function flush(docId: string, ydoc: Y.Doc): Promise<void> {
    const snapshot = yDocToSnapshot(ydoc);
    const stateVector = Y.encodeStateVector(ydoc);
    const revisionId = computeRevisionId(stateVector);

    await repo.saveSnapshot({ docId, snapshot, revisionId, stateVector });

    log.info('snapshot materialised', { docId, revisionId: revisionId.slice(0, 8) });

    if (eventBus) {
      const docUpdatedEvent = {
        id: randomUUID(),
        type: EventType.DocumentUpdated,
        aggregateId: docId,
        revisionId,
        actorId: 'system:materializer',
        actorType: 'system' as const,
        occurredAt: new Date().toISOString(),
      };
      await eventBus.emit(docUpdatedEvent, null);

      const stateFlushedEvent = {
        id: randomUUID(),
        type: EventType.StateFlushed,
        aggregateId: docId,
        revisionId,
        actorId: 'system:materializer',
        actorType: 'system' as const,
        occurredAt: new Date().toISOString(),
      };
      await eventBus.emit(stateFlushedEvent, null);
    }
  }

  return { schedule, flush };
}
