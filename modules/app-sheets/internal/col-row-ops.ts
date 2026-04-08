/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';
import { getFormatMap } from './format/store.ts';

type FormatEntries = Array<[string, string]>;

function parseKey(key: string): { row: number; col: number } {
  const [r, c] = key.split(':').map(Number);
  return { row: r, col: c };
}

function fmtKey(row: number, col: number): string {
  return `${row}:${col}`;
}

/** Collect all format entries from the Y.Map as plain tuples. */
function collectFormats(fmtMap: Y.Map<string>): FormatEntries {
  const entries: FormatEntries = [];
  fmtMap.forEach((val, key) => entries.push([key, val]));
  return entries;
}

/** Shift format keys when a row is inserted. Keys at or below `atRow` move down. */
function shiftFormatsRowInsert(fmtMap: Y.Map<string>, atRow: number): void {
  const entries = collectFormats(fmtMap);
  const toDelete: string[] = [];
  const toSet: [string, string][] = [];

  for (const [key, val] of entries) {
    const { row, col } = parseKey(key);
    if (row >= atRow) {
      toDelete.push(key);
      toSet.push([fmtKey(row + 1, col), val]);
    }
  }
  for (const k of toDelete) fmtMap.delete(k);
  for (const [k, v] of toSet) fmtMap.set(k, v);
}

/** Shift format keys when a row is deleted. Keys below `atRow` move up. */
function shiftFormatsRowDelete(fmtMap: Y.Map<string>, atRow: number): void {
  const entries = collectFormats(fmtMap);
  const toDelete: string[] = [];
  const toSet: [string, string][] = [];

  for (const [key, val] of entries) {
    const { row, col } = parseKey(key);
    if (row === atRow) {
      toDelete.push(key);
    } else if (row > atRow) {
      toDelete.push(key);
      toSet.push([fmtKey(row - 1, col), val]);
    }
  }
  for (const k of toDelete) fmtMap.delete(k);
  for (const [k, v] of toSet) fmtMap.set(k, v);
}

/** Shift format keys when a column is inserted. Keys at or right of `atCol` move right. */
function shiftFormatsColInsert(fmtMap: Y.Map<string>, atCol: number): void {
  const entries = collectFormats(fmtMap);
  const toDelete: string[] = [];
  const toSet: [string, string][] = [];

  for (const [key, val] of entries) {
    const { row, col } = parseKey(key);
    if (col >= atCol) {
      toDelete.push(key);
      toSet.push([fmtKey(row, col + 1), val]);
    }
  }
  for (const k of toDelete) fmtMap.delete(k);
  for (const [k, v] of toSet) fmtMap.set(k, v);
}

/** Shift format keys when a column is deleted. Keys right of `atCol` move left. */
function shiftFormatsColDelete(fmtMap: Y.Map<string>, atCol: number): void {
  const entries = collectFormats(fmtMap);
  const toDelete: string[] = [];
  const toSet: [string, string][] = [];

  for (const [key, val] of entries) {
    const { row, col } = parseKey(key);
    if (col === atCol) {
      toDelete.push(key);
    } else if (col > atCol) {
      toDelete.push(key);
      toSet.push([fmtKey(row, col - 1), val]);
    }
  }
  for (const k of toDelete) fmtMap.delete(k);
  for (const [k, v] of toSet) fmtMap.set(k, v);
}

function getSheet(ydoc: Y.Doc, sheetId: string): Y.Array<Y.Array<string>> {
  return ydoc.getArray<Y.Array<string>>(sheetId);
}

/** Insert a row at `atRow` in the given sheet. */
export function insertRow(ydoc: Y.Doc, sheetId: string, atRow: number): void {
  const ysheet = getSheet(ydoc, sheetId);
  const cols = ysheet.length > 0 ? ysheet.get(0).length : 26;
  const fmtMap = getFormatMap(ydoc);

  ydoc.transact(() => {
    shiftFormatsRowInsert(fmtMap, atRow);
    const newRow = new Y.Array<string>();
    newRow.insert(0, new Array(cols).fill(''));
    ysheet.insert(atRow, [newRow]);
  });
}

/** Delete the row at `atRow` from the given sheet. */
export function deleteRow(ydoc: Y.Doc, sheetId: string, atRow: number): void {
  const ysheet = getSheet(ydoc, sheetId);
  if (atRow >= ysheet.length || ysheet.length <= 1) return;
  const fmtMap = getFormatMap(ydoc);

  ydoc.transact(() => {
    shiftFormatsRowDelete(fmtMap, atRow);
    ysheet.delete(atRow, 1);
  });
}

/** Insert a column at `atCol` in every row of the given sheet. */
export function insertColumn(ydoc: Y.Doc, sheetId: string, atCol: number): void {
  const ysheet = getSheet(ydoc, sheetId);
  const fmtMap = getFormatMap(ydoc);

  ydoc.transact(() => {
    shiftFormatsColInsert(fmtMap, atCol);
    for (let r = 0; r < ysheet.length; r++) {
      const yrow = ysheet.get(r);
      yrow.insert(atCol, ['']);
    }
  });
}

/** Delete the column at `atCol` from every row of the given sheet. */
export function deleteColumn(ydoc: Y.Doc, sheetId: string, atCol: number): void {
  const ysheet = getSheet(ydoc, sheetId);
  if (ysheet.length === 0) return;
  if (ysheet.get(0).length <= 1) return;
  const fmtMap = getFormatMap(ydoc);

  ydoc.transact(() => {
    shiftFormatsColDelete(fmtMap, atCol);
    for (let r = 0; r < ysheet.length; r++) {
      const yrow = ysheet.get(r);
      if (atCol < yrow.length) yrow.delete(atCol, 1);
    }
  });
}
