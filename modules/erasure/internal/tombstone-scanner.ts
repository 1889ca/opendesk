/** Contract: contracts/erasure/rules.md */

import * as Y from 'yjs';
import type { TombstoneEntry, TombstoneReport } from '../contract.ts';

/**
 * Scan a Yjs document state and extract all tombstoned (deleted) content.
 *
 * Yjs stores deleted items as tombstones in its internal data structure.
 * This scanner walks the document store to find items marked as deleted
 * and extracts their content for reporting and archival.
 */
export function extractTombstones(
  docId: string,
  crdtState: Uint8Array,
): TombstoneReport {
  const doc = new Y.Doc({ gc: false });
  Y.applyUpdate(doc, crdtState);

  const tombstones: TombstoneEntry[] = [];

  // Walk all shared types that exist in the document's shared state.
  // We must NOT call doc.getText/getArray/etc with names that already
  // exist as different types — Yjs will throw.
  for (const [, type] of doc.share.entries()) {
    const crdtType = inferCrdtType(type);
    scanSharedType(type, crdtType, tombstones);
  }

  doc.destroy();

  return {
    docId,
    tombstones: deduplicateTombstones(tombstones),
    extractedAt: new Date().toISOString(),
  };
}

/** Walk a Yjs AbstractType's internal items for deleted entries. */
function scanSharedType(
  type: Y.AbstractType<unknown>,
  crdtType: TombstoneEntry['crdtType'],
  out: TombstoneEntry[],
): void {
  let item = type._start;
  while (item !== null) {
    if (item.deleted && item.content) {
      const content = extractItemContent(item);
      if (content !== null) {
        out.push({
          itemId: `${item.id.client}:${item.id.clock}`,
          content,
          deletedAt: null, // Yjs doesn't track deletion timestamps
          deletedBy: item.id.client !== 0 ? String(item.id.client) : null,
          crdtType,
        });
      }
    }
    item = item.right;
  }
}

/** Extract string content from a Yjs Item. */
function extractItemContent(item: { content: unknown }): string | null {
  const content = item.content as Record<string, unknown>;

  // ContentString
  if (typeof content.str === 'string') {
    return content.str;
  }

  // ContentJSON
  if (Array.isArray(content.arr)) {
    return JSON.stringify(content.arr);
  }

  // ContentAny
  if (Array.isArray(content.arr)) {
    return JSON.stringify(content.arr);
  }

  // ContentType (nested types)
  if (content.type && typeof content.type === 'object') {
    return '[nested-type]';
  }

  return null;
}

function inferCrdtType(
  type: Y.AbstractType<unknown>,
): TombstoneEntry['crdtType'] {
  if (type instanceof Y.XmlFragment || type instanceof Y.XmlElement) return 'xml';
  if (type instanceof Y.Text) return 'text';
  if (type instanceof Y.Array) return 'array';
  if (type instanceof Y.Map) return 'map';
  return 'text';
}

/** Remove duplicates based on itemId. */
function deduplicateTombstones(entries: TombstoneEntry[]): TombstoneEntry[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    if (seen.has(e.itemId)) return false;
    seen.add(e.itemId);
    return true;
  });
}
