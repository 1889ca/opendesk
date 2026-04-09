/** Contract: contracts/app-slides/rules.md */

import type { ShapeType } from './types.ts';

export type InsertAction =
  | { type: 'text' }
  | { type: 'image' }
  | { type: 'shape'; shapeType: ShapeType }
  | { type: 'table'; rows: number; cols: number };

export type InsertHandler = (action: InsertAction) => void;

type ToolbarItem = {
  label: string;
  icon: string;
  action: InsertAction | null;
  submenu?: ToolbarItem[];
};

const TOOLBAR_ITEMS: ToolbarItem[] = [
  { label: 'Text', icon: 'T', action: { type: 'text' } },
  { label: 'Image', icon: '\u{1F5BC}', action: { type: 'image' } },
  {
    label: 'Shapes', icon: '\u25A0', action: null,
    submenu: [
      { label: 'Rectangle', icon: '\u25AC', action: { type: 'shape', shapeType: 'rectangle' } },
      { label: 'Rounded', icon: '\u25A2', action: { type: 'shape', shapeType: 'rounded-rect' } },
      { label: 'Circle', icon: '\u25CF', action: { type: 'shape', shapeType: 'ellipse' } },
      { label: 'Triangle', icon: '\u25B2', action: { type: 'shape', shapeType: 'triangle' } },
      { label: 'Arrow', icon: '\u27A1', action: { type: 'shape', shapeType: 'arrow' } },
      { label: 'Line', icon: '\u2014', action: { type: 'shape', shapeType: 'line' } },
    ],
  },
  { label: 'Table', icon: '\u229E', action: null },
];

/** Create the insert toolbar DOM element */
export function createInsertToolbar(onInsert: InsertHandler): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'slide-insert-toolbar';

  for (const item of TOOLBAR_ITEMS) {
    if (item.label === 'Table') {
      toolbar.appendChild(createTableButton(onInsert));
    } else if (item.submenu) {
      toolbar.appendChild(createDropdownButton(item, onInsert));
    } else if (item.action) {
      toolbar.appendChild(createButton(item, onInsert));
    }
  }

  return toolbar;
}

function createButton(item: ToolbarItem, onInsert: InsertHandler): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'slide-insert-btn';
  btn.title = item.label;
  btn.textContent = item.icon;
  btn.addEventListener('click', () => {
    if (item.action) onInsert(item.action);
  });
  return btn;
}

function createDropdownButton(item: ToolbarItem, onInsert: InsertHandler): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'slide-insert-dropdown';

  const btn = document.createElement('button');
  btn.className = 'slide-insert-btn';
  btn.title = item.label;
  btn.textContent = item.icon;
  wrapper.appendChild(btn);

  const menu = document.createElement('div');
  menu.className = 'slide-insert-menu';

  for (const sub of item.submenu || []) {
    const subBtn = document.createElement('button');
    subBtn.className = 'slide-insert-menu-item';
    subBtn.textContent = `${sub.icon} ${sub.label}`;
    subBtn.addEventListener('click', () => {
      if (sub.action) onInsert(sub.action);
      menu.classList.remove('visible');
    });
    menu.appendChild(subBtn);
  }

  btn.addEventListener('click', () => {
    menu.classList.toggle('visible');
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target as Node)) {
      menu.classList.remove('visible');
    }
  });

  wrapper.appendChild(menu);
  return wrapper;
}

function createTableButton(onInsert: InsertHandler): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'slide-insert-dropdown';

  const btn = document.createElement('button');
  btn.className = 'slide-insert-btn';
  btn.title = 'Table';
  btn.textContent = '\u229E';
  wrapper.appendChild(btn);

  const menu = document.createElement('div');
  menu.className = 'slide-insert-menu slide-table-grid-menu';

  const grid = createTableGrid(onInsert, menu);
  menu.appendChild(grid);

  btn.addEventListener('click', () => {
    menu.classList.toggle('visible');
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target as Node)) {
      menu.classList.remove('visible');
    }
  });

  wrapper.appendChild(menu);
  return wrapper;
}

function createTableGrid(onInsert: InsertHandler, menu: HTMLElement): HTMLElement {
  const container = document.createElement('div');
  container.className = 'slide-table-grid';

  const label = document.createElement('div');
  label.className = 'slide-table-grid-label';
  label.textContent = 'Select size';
  container.appendChild(label);

  const grid = document.createElement('div');
  grid.className = 'slide-table-grid-cells';

  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      const cell = document.createElement('div');
      cell.className = 'slide-table-grid-cell';
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      cell.addEventListener('mouseenter', () => highlightGrid(grid, r, c, label));
      cell.addEventListener('click', () => {
        onInsert({ type: 'table', rows: r + 1, cols: c + 1 });
        menu.classList.remove('visible');
      });
      grid.appendChild(cell);
    }
  }

  container.appendChild(grid);
  return container;
}

function highlightGrid(grid: HTMLElement, row: number, col: number, label: HTMLElement): void {
  const cells = grid.querySelectorAll('.slide-table-grid-cell');
  cells.forEach((cell) => {
    const cr = Number((cell as HTMLElement).dataset.row);
    const cc = Number((cell as HTMLElement).dataset.col);
    cell.classList.toggle('highlighted', cr <= row && cc <= col);
  });
  label.textContent = `${row + 1} x ${col + 1}`;
}
