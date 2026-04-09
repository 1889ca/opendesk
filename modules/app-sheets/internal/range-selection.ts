/** Contract: contracts/app-sheets/rules.md */

export interface CellRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

type SelectionCallback = (range: CellRange | null) => void;

export interface RangeSelection {
  getRange(): CellRange | null;
  setRange(range: CellRange | null): void;
  clear(): void;
  onSelectionChange(cb: SelectionCallback): void;
  destroy(): void;
}

function normalize(range: CellRange): CellRange {
  return {
    startRow: Math.min(range.startRow, range.endRow),
    startCol: Math.min(range.startCol, range.endCol),
    endRow: Math.max(range.startRow, range.endRow),
    endCol: Math.max(range.startCol, range.endCol),
  };
}

function cellAt(el: HTMLElement): { row: number; col: number } | null {
  const cell = el.closest<HTMLElement>('[data-row][data-col]');
  if (!cell) return null;
  return { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
}

function inRange(row: number, col: number, r: CellRange): boolean {
  return row >= r.startRow && row <= r.endRow && col >= r.startCol && col <= r.endCol;
}

function applyClasses(gridEl: HTMLElement, range: CellRange | null): void {
  const prev = gridEl.querySelectorAll(
    '.cell--selected, .cell--selection-edge-top, .cell--selection-edge-bottom, .cell--selection-edge-left, .cell--selection-edge-right',
  );
  Array.from(prev).forEach((el) => {
    el.classList.remove(
      'cell--selected', 'cell--selection-edge-top', 'cell--selection-edge-bottom',
      'cell--selection-edge-left', 'cell--selection-edge-right',
    );
  });
  if (!range) return;

  const cells = gridEl.querySelectorAll<HTMLElement>('[data-row][data-col]');
  Array.from(cells).forEach((cell) => {
    const r = Number(cell.dataset.row);
    const c = Number(cell.dataset.col);
    if (!inRange(r, c, range)) return;
    cell.classList.add('cell--selected');
    if (r === range.startRow) cell.classList.add('cell--selection-edge-top');
    if (r === range.endRow) cell.classList.add('cell--selection-edge-bottom');
    if (c === range.startCol) cell.classList.add('cell--selection-edge-left');
    if (c === range.endCol) cell.classList.add('cell--selection-edge-right');
  });
}

export function createRangeSelection(gridEl: HTMLElement): RangeSelection {
  let range: CellRange | null = null;
  let anchor: { row: number; col: number } | null = null;
  let dragging = false;
  const listeners: SelectionCallback[] = [];

  function notify(): void {
    for (const cb of listeners) cb(range);
  }

  function set(r: CellRange | null): void {
    range = r ? normalize(r) : null;
    applyClasses(gridEl, range);
    notify();
  }

  function onMouseDown(e: MouseEvent): void {
    const pos = cellAt(e.target as HTMLElement);
    if (!pos) return;
    if (e.shiftKey && anchor) {
      set({ startRow: anchor.row, startCol: anchor.col, endRow: pos.row, endCol: pos.col });
    } else {
      anchor = pos;
      set({ startRow: pos.row, startCol: pos.col, endRow: pos.row, endCol: pos.col });
    }
    dragging = true;
  }

  function onMouseMove(e: MouseEvent): void {
    if (!dragging || !anchor) return;
    const pos = cellAt(e.target as HTMLElement);
    if (!pos) return;
    set({ startRow: anchor.row, startCol: anchor.col, endRow: pos.row, endCol: pos.col });
  }

  function onMouseUp(): void {
    dragging = false;
  }

  gridEl.addEventListener('mousedown', onMouseDown);
  gridEl.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  return {
    getRange: () => range,
    setRange: (r) => {
      if (r) anchor = { row: r.startRow, col: r.startCol };
      set(r);
    },
    clear: () => { anchor = null; set(null); },
    onSelectionChange: (cb) => { listeners.push(cb); },
    destroy() {
      gridEl.removeEventListener('mousedown', onMouseDown);
      gridEl.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      listeners.length = 0;
    },
  };
}
