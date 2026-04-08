/** Contract: contracts/sheets-formatting/rules.md */
import * as Y from 'yjs';
import type { CellFormat } from './sheets-format-types.ts';

/**
 * Yjs-backed format store. Stores cell formats in a Y.Map keyed by "row:col".
 * All mutations go through Yjs transactions for real-time sync.
 */

const FORMAT_MAP_KEY = 'sheet-0-formats';

/** Get or create the shared format map from the Yjs document. */
export function getFormatMap(ydoc: Y.Doc): Y.Map<string> {
  return ydoc.getMap<string>(FORMAT_MAP_KEY);
}

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

/** Read the CellFormat for a given cell. Returns undefined if no format set. */
export function getCellFormat(ydoc: Y.Doc, row: number, col: number): CellFormat | undefined {
  const map = getFormatMap(ydoc);
  const raw = map.get(cellKey(row, col));
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as CellFormat;
  } catch {
    return undefined;
  }
}

/** Write a CellFormat for a given cell. Merges with existing format. */
export function setCellFormat(ydoc: Y.Doc, row: number, col: number, updates: Partial<CellFormat>): void {
  const map = getFormatMap(ydoc);
  const key = cellKey(row, col);
  const existing = getCellFormat(ydoc, row, col) || {};
  const merged = { ...existing, ...updates };

  // Remove undefined/false values to keep it clean
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== false) {
      cleaned[k] = v;
    }
  }

  ydoc.transact(() => {
    if (Object.keys(cleaned).length === 0) {
      map.delete(key);
    } else {
      map.set(key, JSON.stringify(cleaned));
    }
  });
}

/** Toggle a boolean format property (bold, italic, underline, strikethrough). */
export function toggleBoolFormat(
  ydoc: Y.Doc,
  row: number,
  col: number,
  prop: 'bold' | 'italic' | 'underline' | 'strikethrough',
): void {
  const current = getCellFormat(ydoc, row, col);
  const currentVal = current?.[prop] ?? false;
  setCellFormat(ydoc, row, col, { [prop]: !currentVal });
}

/** Clear all formatting for a cell. */
export function clearCellFormat(ydoc: Y.Doc, row: number, col: number): void {
  const map = getFormatMap(ydoc);
  map.delete(cellKey(row, col));
}
