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
 * Extract live content from all shared types in a Yjs document.
 * This captures the current state without any history or tombstones.
 */
export function extractContent(doc: Y.Doc): DocContentSnapshot {
  const snapshot: DocContentSnapshot = {
    texts: [],
    maps: [],
    arrays: [],
    xmlFragments: [],
  };

  // Iterate over all shared types in the document
  for (const [name, type] of doc.share.entries()) {
    if (type instanceof Y.Text) {
      snapshot.texts.push({ name, value: type.toString() });
    } else if (type instanceof Y.Map) {
      const entries: Array<[string, unknown]> = [];
      type.forEach((value, key) => entries.push([key, value]));
      snapshot.maps.push({ name, entries });
    } else if (type instanceof Y.Array) {
      snapshot.arrays.push({ name, items: type.toArray() });
    } else if (type instanceof Y.XmlFragment) {
      snapshot.xmlFragments.push({ name, xml: type.toString() });
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
