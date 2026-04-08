/** Contract: contracts/app/rules.md */

/**
 * Spreadsheet import/export handlers.
 * CSV import/export runs client-side for speed.
 * XLSX/ODS routes through the server-side Collabora pipeline.
 */

import { apiFetch } from '../shared/api-client.ts';

type YSheet = {
  get(index: number): { get(col: number): string; length: number; delete(pos: number, len: number): void; insert(pos: number, vals: string[]): void };
  length: number;
};

type YDoc = {
  transact(fn: () => void): void;
};

export function setupSheetImport(
  docId: string,
  getYSheet: () => YSheet,
  getYDoc: () => YDoc,
  getCols: () => number,
  getRows: () => number,
): void {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.xlsx,.ods,.csv';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  document.getElementById('sheet-import')?.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    fileInput.value = '';

    if (!confirm('Importing will replace current sheet data. Continue?')) {
      return;
    }

    const btn = document.getElementById('sheet-import') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = '...';

    file.arrayBuffer()
      .then((buf) => apiFetch(`/api/sheets/${encodeURIComponent(docId)}/import`, {
        method: 'POST',
        headers: { 'X-Filename': file.name },
        body: buf,
      }))
      .then((res) => {
        if (!res.ok) throw new Error(
          res.status === 502 ? 'Conversion service unavailable' : 'Import failed',
        );
        return res.json();
      })
      .then((data: { grid?: string[][] }) => {
        if (data.grid) {
          applyGridToYjs(data.grid, getYSheet(), getYDoc(), getCols());
        }
      })
      .catch((err) => alert(err.message))
      .finally(() => { btn.disabled = false; btn.textContent = 'Import'; });
  });
}

export function setupSheetExport(
  docId: string,
  getYSheet: () => YSheet,
  getCols: () => number,
): void {
  function exportSheet(format: string): void {
    const grid = extractGridFromYjs(getYSheet(), getCols());
    const title = getTitle();
    const btn = document.getElementById(`sheet-export-${format}`) as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = '...';

    apiFetch(`/api/sheets/${encodeURIComponent(docId)}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, grid, title }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Export failed');
        return res.blob();
      })
      .then((blob) => downloadBlob(blob, `${title}.${format}`, blob.type))
      .catch((err) => alert(err.message))
      .finally(() => {
        btn.disabled = false;
        btn.textContent = format.toUpperCase();
      });
  }

  document.getElementById('sheet-export-csv')?.addEventListener('click', () => exportSheet('csv'));
  document.getElementById('sheet-export-xlsx')?.addEventListener('click', () => exportSheet('xlsx'));
  document.getElementById('sheet-export-ods')?.addEventListener('click', () => exportSheet('ods'));
}

function getTitle(): string {
  const input = document.getElementById('doc-title') as HTMLInputElement | null;
  return input?.value?.trim() || 'spreadsheet';
}

function downloadBlob(content: BlobPart, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Extract the Yjs sheet into a 2D string array. */
export function extractGridFromYjs(ysheet: YSheet, cols: number): string[][] {
  const grid: string[][] = [];
  for (let r = 0; r < ysheet.length; r++) {
    const yrow = ysheet.get(r);
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(c < yrow.length ? yrow.get(c) : '');
    }
    grid.push(row);
  }
  return grid;
}

/** Apply an imported grid to the Yjs sheet, resizing as needed. */
export function applyGridToYjs(
  grid: string[][],
  ysheet: YSheet,
  ydoc: YDoc,
  _currentCols: number,
): void {
  ydoc.transact(() => {
    for (let r = 0; r < grid.length && r < ysheet.length; r++) {
      const yrow = ysheet.get(r);
      const row = grid[r];
      for (let c = 0; c < row.length && c < yrow.length; c++) {
        if (yrow.get(c) !== row[c]) {
          yrow.delete(c, 1);
          yrow.insert(c, [row[c]]);
        }
      }
    }
  });
}
