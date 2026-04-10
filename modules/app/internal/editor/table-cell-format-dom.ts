/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { setCellBackground, setCellTextAlign, type CellColor, type AlignButton } from './table-cell-format.ts';

export const CELL_COLORS: CellColor[] = [
  {
    label: 'Clear',
    color: '',
    style:
      'background: repeating-linear-gradient(45deg, #ccc 0, #ccc 2px, white 0, white 50%) center/8px 8px',
  },
  { label: 'Yellow', color: '#fef9c3', style: 'background: #fef9c3' },
  { label: 'Green', color: '#dcfce7', style: 'background: #dcfce7' },
  { label: 'Blue', color: '#dbeafe', style: 'background: #dbeafe' },
  { label: 'Red', color: '#fee2e2', style: 'background: #fee2e2' },
  { label: 'Purple', color: '#f3e8ff', style: 'background: #f3e8ff' },
  { label: 'Gray', color: '#f3f4f6', style: 'background: #f3f4f6' },
];

export const CELL_ALIGN_BUTTONS: AlignButton[] = [
  { label: 'Align left', align: 'left', icon: '⬅' },
  { label: 'Align center', align: 'center', icon: '↔' },
  { label: 'Align right', align: 'right', icon: '➡' },
];

/** Build the cell formatting section DOM and append it to the container. */
export function buildCellFormatSection(
  container: HTMLElement,
  editor: Editor,
): void {
  // Separator
  const sep1 = document.createElement('div');
  sep1.className = 'table-toolbar-cell-section';

  const label = document.createElement('span');
  label.className = 'table-toolbar-label';
  label.textContent = 'Cell:';
  sep1.appendChild(label);

  // Color swatches
  for (const { label: colorLabel, color, style } of CELL_COLORS) {
    const btn = document.createElement('button');
    btn.className = 'table-toolbar-color-swatch';
    btn.title = colorLabel;
    btn.setAttribute('aria-label', `Cell background: ${colorLabel}`);
    btn.setAttribute('style', style);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      setCellBackground(editor, color);
    });
    sep1.appendChild(btn);
  }

  container.appendChild(sep1);

  // Alignment section
  const sep2 = document.createElement('div');
  sep2.className = 'table-toolbar-cell-section';

  const alignLabel = document.createElement('span');
  alignLabel.className = 'table-toolbar-label';
  alignLabel.textContent = 'Align:';
  sep2.appendChild(alignLabel);

  for (const { label: alignLabel2, align, icon } of CELL_ALIGN_BUTTONS) {
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn table-toolbar-btn';
    btn.title = alignLabel2;
    btn.setAttribute('aria-label', alignLabel2);
    btn.textContent = icon;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      setCellTextAlign(editor, align);
    });
    sep2.appendChild(btn);
  }

  container.appendChild(sep2);
}
