/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';
import type { RangeSelection, CellRange } from './range-selection.ts';
import type { SheetStore } from './sheet-store.ts';
import { getCellFormat, setCellFormat, clearCellFormat } from './format/store.ts';
import type { CellFormat } from './format/types.ts';

const OPENDESK_MIME = 'application/x-opendesk-cells';

interface CellData {
  value: string;
  format?: CellFormat;
}

function serializeRange(
  range: CellRange,
  ysheet: Y.Array<Y.Array<string>>,
  ydoc: Y.Doc,
): { tsv: string; json: string } {
  const rows: CellData[][] = [];
  const tsvRows: string[] = [];

  for (let r = range.startRow; r <= range.endRow; r++) {
    const row: CellData[] = [];
    const tsvCells: string[] = [];
    const yrow = r < ysheet.length ? ysheet.get(r) : null;
    for (let c = range.startCol; c <= range.endCol; c++) {
      const value = yrow && c < yrow.length ? yrow.get(c) : '';
      const format = getCellFormat(ydoc, r, c);
      row.push(format ? { value, format } : { value });
      tsvCells.push(value);
    }
    rows.push(row);
    tsvRows.push(tsvCells.join('\t'));
  }

  return { tsv: tsvRows.join('\n'), json: JSON.stringify(rows) };
}

function clearRange(
  range: CellRange,
  ysheet: Y.Array<Y.Array<string>>,
  ydoc: Y.Doc,
): void {
  ydoc.transact(() => {
    for (let r = range.startRow; r <= range.endRow; r++) {
      if (r >= ysheet.length) continue;
      const yrow = ysheet.get(r);
      for (let c = range.startCol; c <= range.endCol; c++) {
        if (c < yrow.length) { yrow.delete(c, 1); yrow.insert(c, ['']); }
        clearCellFormat(ydoc, r, c);
      }
    }
  });
}

function parseTsv(text: string): string[][] {
  return text.split('\n').map((line) => line.split('\t'));
}

function pasteData(
  data: CellData[][],
  anchorRow: number,
  anchorCol: number,
  ysheet: Y.Array<Y.Array<string>>,
  ydoc: Y.Doc,
): void {
  ydoc.transact(() => {
    for (let dr = 0; dr < data.length; dr++) {
      const r = anchorRow + dr;
      if (r >= ysheet.length) continue;
      const yrow = ysheet.get(r);
      for (let dc = 0; dc < data[dr].length; dc++) {
        const c = anchorCol + dc;
        if (c >= yrow.length) continue;
        const cell = data[dr][dc];
        yrow.delete(c, 1);
        yrow.insert(c, [cell.value]);
        if (cell.format) {
          setCellFormat(ydoc, r, c, cell.format);
        } else {
          clearCellFormat(ydoc, r, c);
        }
      }
    }
  });
}

export interface ClipboardManager {
  destroy(): void;
}

export function createClipboardManager(
  gridEl: HTMLElement,
  rangeSelection: RangeSelection,
  sheetStore: SheetStore,
  formatStore: { ydoc: Y.Doc; ysheet: () => Y.Array<Y.Array<string>> },
): ClipboardManager {
  const { ydoc } = formatStore;

  function onCopy(e: ClipboardEvent): void {
    const range = rangeSelection.getRange();
    if (!range) return;
    e.preventDefault();
    const { tsv, json } = serializeRange(range, formatStore.ysheet(), ydoc);
    e.clipboardData?.setData('text/plain', tsv);
    e.clipboardData?.setData(OPENDESK_MIME, json);
  }

  function onCut(e: ClipboardEvent): void {
    const range = rangeSelection.getRange();
    if (!range) return;
    e.preventDefault();
    const { tsv, json } = serializeRange(range, formatStore.ysheet(), ydoc);
    e.clipboardData?.setData('text/plain', tsv);
    e.clipboardData?.setData(OPENDESK_MIME, json);
    clearRange(range, formatStore.ysheet(), ydoc);
  }

  function onPaste(e: ClipboardEvent): void {
    const range = rangeSelection.getRange();
    if (!range) return;
    e.preventDefault();
    const anchorRow = range.startRow;
    const anchorCol = range.startCol;

    const odJson = e.clipboardData?.getData(OPENDESK_MIME);
    if (odJson) {
      try {
        const data = JSON.parse(odJson) as CellData[][];
        pasteData(data, anchorRow, anchorCol, formatStore.ysheet(), ydoc);
        return;
      } catch { /* fall through to plain text */ }
    }

    const text = e.clipboardData?.getData('text/plain') || '';
    const rows = parseTsv(text);
    const data: CellData[][] = rows.map((row) => row.map((value) => ({ value })));
    pasteData(data, anchorRow, anchorCol, formatStore.ysheet(), ydoc);
  }

  gridEl.addEventListener('copy', onCopy);
  gridEl.addEventListener('cut', onCut);
  gridEl.addEventListener('paste', onPaste);

  return {
    destroy() {
      gridEl.removeEventListener('copy', onCopy);
      gridEl.removeEventListener('cut', onCut);
      gridEl.removeEventListener('paste', onPaste);
    },
  };
}
