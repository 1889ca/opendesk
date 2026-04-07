/** Contract: contracts/collab/rules.md */
import * as Y from 'yjs';
import type { StorageAdapter } from './compaction-manager.ts';

export interface PurgeResult {
  documentId: string;
  originalSize: number;
  purgedSize: number;
  durationMs: number;
}

/**
 * Purge compaction: destroys all CRDT history and tombstones
 * by materializing the current content into a fresh Yjs document.
 *
 * Unlike regular compaction (which re-encodes the same doc),
 * purge creates a brand-new Yjs Doc with a fresh client ID
 * and copies only the live content. The result contains zero
 * tombstones, zero operation history, and zero deleted content.
 */
export async function purgeDocument(
  documentId: string,
  storage: StorageAdapter,
): Promise<PurgeResult> {
  const startMs = Date.now();

  const state = await storage.loadYjsState(documentId);
  if (!state) {
    throw new Error(`Document ${documentId} not found in storage`);
  }

  const originalSize = state.byteLength;

  // Load the current doc to materialize its content
  const sourceDoc = new Y.Doc();
  Y.applyUpdate(sourceDoc, state);

  // Extract all shared types and their content
  const snapshot = extractContent(sourceDoc);
  sourceDoc.destroy();

  // Build a fresh Yjs doc with only the live content
  const freshDoc = new Y.Doc();
  applyContent(freshDoc, snapshot);

  const freshState = Y.encodeStateAsUpdate(freshDoc);
  freshDoc.destroy();

  // Atomically replace the old state
  await storage.saveYjsState(documentId, freshState);

  return {
    documentId,
    originalSize,
    purgedSize: freshState.byteLength,
    durationMs: Date.now() - startMs,
  };
}

/** Snapshot of all shared type content from a Yjs doc. */
export interface DocContentSnapshot {
  texts: Array<{ name: string; value: string }>;
  maps: Array<{ name: string; entries: Array<[string, unknown]> }>;
  arrays: Array<{ name: string; items: unknown[] }>;
  xmlFragments: Array<{ name: string; xml: string }>;
}

/**
 * Detect the shared type kind for a Yjs AbstractType loaded from binary state.
 * After Y.applyUpdate, shared types are AbstractType instances (not Y.Text etc.),
 * so instanceof checks fail. We inspect the internal structure instead:
 * - _map.size > 0 → Map
 * - _start with ContentString items → Text
 * - _start with other items → Array
 * - no content → empty (treat as Text, the most common default)
 */
function detectTypeKind(
  type: Y.AbstractType<unknown>,
): 'text' | 'map' | 'array' {
  const abstractType = type as unknown as {
    _map?: Map<string, unknown>;
    _start?: { content?: { constructor?: { name?: string } }; right?: unknown } | null;
  };

  if (abstractType._map && abstractType._map.size > 0) {
    return 'map';
  }

  let item = abstractType._start;
  while (item) {
    const contentName = item.content?.constructor?.name;
    if (contentName === 'ContentString') return 'text';
    if (contentName === 'ContentAny') return 'array';
    item = item.right as typeof item;
  }

  // Default: treat as text (most common for empty shared types)
  return 'text';
}

/**
 * Extract live content from all shared types in a Yjs document.
 * This captures the current state without any history or tombstones.
 * Handles both directly created docs and docs loaded from binary state.
 */
export function extractContent(doc: Y.Doc): DocContentSnapshot {
  const snapshot: DocContentSnapshot = {
    texts: [],
    maps: [],
    arrays: [],
    xmlFragments: [],
  };

  for (const [name, type] of doc.share.entries()) {
    const kind = detectTypeKind(type as Y.AbstractType<unknown>);

    if (kind === 'text') {
      // Use getText() to get properly typed access
      snapshot.texts.push({ name, value: doc.getText(name).toString() });
    } else if (kind === 'map') {
      const map = doc.getMap(name);
      const entries: Array<[string, unknown]> = [];
      map.forEach((value, key) => entries.push([key, value]));
      snapshot.maps.push({ name, entries });
    } else {
      const arr = doc.getArray(name);
      snapshot.arrays.push({ name, items: arr.toArray() });
    }
  }

  return snapshot;
}

/**
 * Apply extracted content to a fresh Yjs document.
 * Creates new shared types and populates them with the snapshot data.
 */
export function applyContent(
  doc: Y.Doc,
  snapshot: DocContentSnapshot,
): void {
  doc.transact(() => {
    for (const { name, value } of snapshot.texts) {
      const text = doc.getText(name);
      if (value.length > 0) {
        text.insert(0, value);
      }
    }

    for (const { name, entries } of snapshot.maps) {
      const map = doc.getMap(name);
      for (const [key, val] of entries) {
        map.set(key, val);
      }
    }

    for (const { name, items } of snapshot.arrays) {
      const arr = doc.getArray(name);
      if (items.length > 0) {
        arr.push(items);
      }
    }

    for (const { name, xml } of snapshot.xmlFragments) {
      // XmlFragment content is re-created as a text node
      const frag = doc.getXmlFragment(name);
      if (xml.length > 0) {
        const textNode = new Y.XmlText(xml);
        frag.insert(0, [textNode]);
      }
    }
  });
}
