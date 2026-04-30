/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import {
  CELL_COLORS,
  CELL_ALIGN_BUTTONS,
  setCellBackground,
  setCellTextAlign,
} from './table-cell-format.ts';

/** Build the cell formatting section DOM and append it to the container. */
export function buildCellFormatSection(
  container: HTMLElement,
  editor: Editor,
): void {
  const sep1 = document.createElement('div');
  sep1.className = 'table-toolbar-cell-section';

  const label = document.createElement('span');
  label.className = 'table-toolbar-label';
  label.textContent = 'Cell:';
  sep1.appendChild(label);

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

  const sep2 = document.createElement('div');
  sep2.className = 'table-toolbar-cell-section';

  const alignLabel = document.createElement('span');
  alignLabel.className = 'table-toolbar-label';
  alignLabel.textContent = 'Align:';
  sep2.appendChild(alignLabel);

  for (const { label: alignBtnLabel, align, icon } of CELL_ALIGN_BUTTONS) {
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn table-toolbar-btn';
    btn.title = alignBtnLabel;
    btn.setAttribute('aria-label', alignBtnLabel);
    btn.textContent = icon;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      setCellTextAlign(editor, align);
    });
    sep2.appendChild(btn);
  }

  container.appendChild(sep2);
}
