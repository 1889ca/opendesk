/** Contract: contracts/app-sheets/rules.md */

export interface CellContextMenuCallbacks {
  cutCell(row: number, col: number): void;
  copyCell(row: number, col: number): void;
  pasteCell(row: number, col: number): void;
  clearCell(row: number, col: number): void;
  insertRowAboveCell(row: number): void;
  insertRowBelowCell(row: number): void;
  deleteRowAtCell(row: number): void;
}

export interface ContextMenuCallbacks {
  insertRowAbove(row: number): void;
  insertRowBelow(row: number): void;
  deleteRow(row: number): void;
  insertColumnLeft(col: number): void;
  insertColumnRight(col: number): void;
  deleteColumn(col: number): void;
  sortColumn?(col: number, direction: 'asc' | 'desc'): void;
  cellMenu?: CellContextMenuCallbacks;
}

export interface HeaderContextMenu {
  destroy(): void;
}

interface MenuItem {
  label: string;
  action: () => void;
}

function buildMenu(items: MenuItem[]): HTMLDivElement {
  const menu = document.createElement('div');
  menu.className = 'sheet-context-menu';
  for (const item of items) {
    const btn = document.createElement('button');
    btn.className = 'sheet-context-menu-item';
    btn.textContent = item.label;
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      item.action();
    });
    menu.appendChild(btn);
  }
  return menu;
}

function positionMenu(menu: HTMLElement, x: number, y: number): void {
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  document.body.appendChild(menu);
  // Adjust if overflowing viewport
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = `${x - rect.width}px`;
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${y - rect.height}px`;
  }
}

export function createHeaderContextMenu(
  gridEl: HTMLElement,
  callbacks: ContextMenuCallbacks,
): HeaderContextMenu {
  let activeMenu: HTMLDivElement | null = null;

  function dismiss(): void {
    if (activeMenu) {
      activeMenu.remove();
      activeMenu = null;
    }
  }

  function dismissAndAct(fn: () => void): () => void {
    return () => { dismiss(); fn(); };
  }

  function onContextMenu(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    // Column header right-click
    const colIdx = target.dataset.colHeader;
    if (colIdx != null && target.classList.contains('header')) {
      e.preventDefault();
      dismiss();
      const col = Number(colIdx);
      const items: MenuItem[] = [];
      if (callbacks.sortColumn) {
        items.push(
          { label: 'Sort A \u2192 Z', action: dismissAndAct(() => callbacks.sortColumn!(col, 'asc')) },
          { label: 'Sort Z \u2192 A', action: dismissAndAct(() => callbacks.sortColumn!(col, 'desc')) },
        );
      }
      items.push(
        { label: 'Insert column left', action: dismissAndAct(() => callbacks.insertColumnLeft(col)) },
        { label: 'Insert column right', action: dismissAndAct(() => callbacks.insertColumnRight(col + 1)) },
        { label: 'Delete column', action: dismissAndAct(() => callbacks.deleteColumn(col)) },
      );
      activeMenu = buildMenu(items);
      positionMenu(activeMenu, e.clientX, e.clientY);
      return;
    }

    // Row header right-click
    const rowIdx = target.dataset.rowHeader;
    if (rowIdx != null && target.classList.contains('row-header')) {
      e.preventDefault();
      dismiss();
      const row = Number(rowIdx);
      activeMenu = buildMenu([
        { label: 'Insert row above', action: dismissAndAct(() => callbacks.insertRowAbove(row)) },
        { label: 'Insert row below', action: dismissAndAct(() => callbacks.insertRowBelow(row + 1)) },
        { label: 'Delete row', action: dismissAndAct(() => callbacks.deleteRow(row)) },
      ]);
      positionMenu(activeMenu, e.clientX, e.clientY);
      return;
    }

    // Data cell right-click
    const cellRow = target.dataset.row;
    const cellCol = target.dataset.col;
    if (cellRow != null && cellCol != null && callbacks.cellMenu) {
      e.preventDefault();
      dismiss();
      const row = Number(cellRow);
      const col = Number(cellCol);
      const cm = callbacks.cellMenu;
      activeMenu = buildMenu([
        { label: 'Cut', action: dismissAndAct(() => cm.cutCell(row, col)) },
        { label: 'Copy', action: dismissAndAct(() => cm.copyCell(row, col)) },
        { label: 'Paste', action: dismissAndAct(() => cm.pasteCell(row, col)) },
        { label: 'Clear cell', action: dismissAndAct(() => cm.clearCell(row, col)) },
        { label: 'Insert row above', action: dismissAndAct(() => cm.insertRowAboveCell(row)) },
        { label: 'Insert row below', action: dismissAndAct(() => cm.insertRowBelowCell(row + 1)) },
        { label: 'Delete row', action: dismissAndAct(() => cm.deleteRowAtCell(row)) },
      ]);
      positionMenu(activeMenu, e.clientX, e.clientY);
      return;
    }
  }

  function onDismiss(e: MouseEvent): void {
    if (activeMenu && !activeMenu.contains(e.target as Node)) {
      dismiss();
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') dismiss();
  }

  gridEl.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('mousedown', onDismiss);
  document.addEventListener('keydown', onKeyDown);

  return {
    destroy() {
      dismiss();
      gridEl.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('mousedown', onDismiss);
      document.removeEventListener('keydown', onKeyDown);
    },
  };
}
