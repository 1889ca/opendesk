/** Contract: contracts/app/rules.md */
import * as Y from 'yjs';

const MIN_COL_WIDTH = 40;
const MIN_ROW_HEIGHT = 24;
const DEFAULT_COL_WIDTH = 80;
const DEFAULT_ROW_HEIGHT = 28;
const HANDLE_ZONE = 5; // px from edge to trigger resize

export interface ColRowResize {
  getColumnWidths(): Map<number, number>;
  getRowHeights(): Map<number, number>;
  applyWidths(gridEl: HTMLElement, cols: number): void;
  destroy(): void;
}

function getYMap(ydoc: Y.Doc, key: string): Y.Map<number> {
  return ydoc.getMap<number>(key);
}

function readSizes(ymap: Y.Map<number>): Map<number, number> {
  const result = new Map<number, number>();
  ymap.forEach((val, key) => result.set(Number(key), val));
  return result;
}

export function createColRowResize(gridEl: HTMLElement, ydoc: Y.Doc): ColRowResize {
  const colWidths = getYMap(ydoc, 'column-widths');
  const rowHeights = getYMap(ydoc, 'row-heights');

  let resizing = false;
  let resizeType: 'col' | 'row' = 'col';
  let resizeIndex = -1;
  let startPos = 0;
  let startSize = 0;
  let overlay: HTMLDivElement | null = null;

  function colWidth(col: number): number {
    return colWidths.get(String(col) as unknown as string) as unknown as number ?? DEFAULT_COL_WIDTH;
  }

  function rowHeight(row: number): number {
    return rowHeights.get(String(row) as unknown as string) as unknown as number ?? DEFAULT_ROW_HEIGHT;
  }

  function applyWidths(el: HTMLElement, cols: number): void {
    const widths: string[] = [];
    for (let c = 0; c < cols; c++) {
      widths.push(`${colWidth(c)}px`);
    }
    el.style.gridTemplateColumns = `3rem ${widths.join(' ')}`;
  }

  function isColHeaderEdge(e: MouseEvent): number | null {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('header') || target.classList.contains('row-header')) return null;
    const colIdx = target.dataset.colHeader;
    if (colIdx == null) return null;
    const rect = target.getBoundingClientRect();
    if (e.clientX >= rect.right - HANDLE_ZONE) return Number(colIdx);
    return null;
  }

  function isRowHeaderEdge(e: MouseEvent): number | null {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('row-header')) return null;
    const rowIdx = target.dataset.rowHeader;
    if (rowIdx == null) return null;
    const rect = target.getBoundingClientRect();
    if (e.clientY >= rect.bottom - HANDLE_ZONE) return Number(rowIdx);
    return null;
  }

  function onMouseMove(e: MouseEvent): void {
    if (resizing) return;
    const col = isColHeaderEdge(e);
    if (col != null) {
      gridEl.style.cursor = 'col-resize';
      return;
    }
    const row = isRowHeaderEdge(e);
    if (row != null) {
      gridEl.style.cursor = 'row-resize';
      return;
    }
    gridEl.style.cursor = '';
  }

  function onMouseDown(e: MouseEvent): void {
    const col = isColHeaderEdge(e);
    if (col != null) {
      e.preventDefault();
      startResize('col', col, e.clientX, colWidth(col));
      return;
    }
    const row = isRowHeaderEdge(e);
    if (row != null) {
      e.preventDefault();
      startResize('row', row, e.clientY, rowHeight(row));
    }
  }

  function startResize(type: 'col' | 'row', idx: number, pos: number, size: number): void {
    resizing = true;
    resizeType = type;
    resizeIndex = idx;
    startPos = pos;
    startSize = size;
    overlay = document.createElement('div');
    overlay.className = 'resize-overlay';
    overlay.style.cssText = `position:fixed;inset:0;z-index:9999;cursor:${type === 'col' ? 'col' : 'row'}-resize;`;
    document.body.appendChild(overlay);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDrag(e: MouseEvent): void {
    if (!resizing) return;
    const delta = resizeType === 'col' ? e.clientX - startPos : e.clientY - startPos;
    const min = resizeType === 'col' ? MIN_COL_WIDTH : MIN_ROW_HEIGHT;
    const newSize = Math.max(min, startSize + delta);
    const ymap = resizeType === 'col' ? colWidths : rowHeights;
    ydoc.transact(() => { ymap.set(String(resizeIndex), newSize); });
  }

  function onDragEnd(): void {
    resizing = false;
    overlay?.remove();
    overlay = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', onDragEnd);
    gridEl.style.cursor = '';
  }

  function onYjsChange(): void {
    const cols = gridEl.querySelectorAll<HTMLElement>('[data-col-header]').length;
    if (cols > 0) applyWidths(gridEl, cols);
  }

  gridEl.addEventListener('mousemove', onMouseMove);
  gridEl.addEventListener('mousedown', onMouseDown);
  colWidths.observe(onYjsChange);
  rowHeights.observe(onYjsChange);

  return {
    getColumnWidths: () => readSizes(colWidths),
    getRowHeights: () => readSizes(rowHeights),
    applyWidths,
    destroy() {
      gridEl.removeEventListener('mousemove', onMouseMove);
      gridEl.removeEventListener('mousedown', onMouseDown);
      colWidths.unobserve(onYjsChange);
      rowHeights.unobserve(onYjsChange);
      if (resizing) onDragEnd();
    },
  };
}
