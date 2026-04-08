/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';
import { getFormatMap } from './format/store.ts';

type FormatEntries = Array<[string, string]>;

function fmtKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function parseKey(key: string): { row: number; col: number } {
  const [r, c] = key.split(':').map(Number);
  return { row: r, col: c };
}

/** Compare two cell values: numeric first, then case-insensitive string. */
export function compareValues(a: string, b: string): number {
  const numA = parseFloat(a);
  const numB = parseFloat(b);
  const aIsNum = a !== '' && !isNaN(numA);
  const bIsNum = b !== '' && !isNaN(numB);

  if (aIsNum && bIsNum) return numA - numB;
  if (aIsNum) return -1;
  if (bIsNum) return 1;

  // Empty strings sort last
  if (a === '' && b === '') return 0;
  if (a === '') return 1;
  if (b === '') return -1;

  return a.toLowerCase().localeCompare(b.toLowerCase());
}

/** Collect format entries for a specific set of rows. */
function collectRowFormats(
  fmtMap: Y.Map<string>,
  rowCount: number,
): Map<number, Map<number, string>> {
  const byRow = new Map<number, Map<number, string>>();
  fmtMap.forEach((val, key) => {
    const { row, col } = parseKey(key);
    if (row >= rowCount) return;
    if (!byRow.has(row)) byRow.set(row, new Map());
    byRow.get(row)!.set(col, val);
  });
  return byRow;
}

/** Sort all rows in a sheet by values in a given column. */
export function sortByColumn(
  ydoc: Y.Doc,
  ysheet: Y.Array<Y.Array<string>>,
  colIndex: number,
  direction: 'asc' | 'desc',
): void {
  const rowCount = ysheet.length;
  if (rowCount === 0) return;

  // Read all row data into plain arrays
  const rows: string[][] = [];
  for (let r = 0; r < rowCount; r++) {
    rows.push(ysheet.get(r).toArray());
  }

  // Build sort indices
  const indices = rows.map((_, i) => i);
  const mult = direction === 'asc' ? 1 : -1;
  indices.sort((a, b) => {
    const va = rows[a][colIndex] ?? '';
    const vb = rows[b][colIndex] ?? '';
    return mult * compareValues(va, vb);
  });

  // Remap format keys
  const fmtMap = getFormatMap(ydoc);
  const oldFormats = collectRowFormats(fmtMap, rowCount);
  const newFormats: FormatEntries = [];
  for (let newRow = 0; newRow < indices.length; newRow++) {
    const oldRow = indices[newRow];
    const rowFmts = oldFormats.get(oldRow);
    if (!rowFmts) continue;
    for (const [col, val] of rowFmts) {
      newFormats.push([fmtKey(newRow, col), val]);
    }
  }

  // Apply sorted data + remapped formats in one transaction
  ydoc.transact(() => {
    // Clear and rebuild all rows
    ysheet.delete(0, rowCount);
    for (const idx of indices) {
      const newRow = new Y.Array<string>();
      newRow.insert(0, rows[idx]);
      ysheet.insert(ysheet.length, [newRow]);
    }

    // Clear old format keys for affected rows, set new ones
    const keysToDelete: string[] = [];
    fmtMap.forEach((_, key) => {
      const { row } = parseKey(key);
      if (row < rowCount) keysToDelete.push(key);
    });
    for (const k of keysToDelete) fmtMap.delete(k);
    for (const [k, v] of newFormats) fmtMap.set(k, v);
  });
}
