/** Contract: contracts/app/rules.md */
/**
 * Table cell toolbar DOM builder.
 * Renders color swatches and alignment buttons into the toolbar container.
 * Extracted from table-cell-format.ts to keep files under 200 lines.
 */
import type { Editor } from '@tiptap/core';
import { CELL_COLORS, CELL_ALIGN_BUTTONS, setCellBackground, setCellTextAlign } from './table-cell-format.ts';

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
