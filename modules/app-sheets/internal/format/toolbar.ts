/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';
import type { CellFormat } from './types.ts';
import {
  appendTextStyleButtons,
  appendFontSizeSelector,
  appendColorPickers,
  appendAlignmentButtons,
  appendNumberFormatSelector,
  appendBorderButtons,
} from './toolbar-sections.ts';

export type FormatToolbarCallbacks = {
  getActiveCell: () => { row: number; col: number };
  onFormatChanged: () => void;
};

/** Create the formatting toolbar and attach it to the given container. */
export function createFormatToolbar(
  container: HTMLElement,
  ydoc: Y.Doc,
  callbacks: FormatToolbarCallbacks,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'format-toolbar';

  appendTextStyleButtons(bar, ydoc, callbacks);
  appendSeparator(bar);
  appendFontSizeSelector(bar, ydoc, callbacks);
  appendSeparator(bar);
  appendColorPickers(bar, ydoc, callbacks);
  appendSeparator(bar);
  appendAlignmentButtons(bar, ydoc, callbacks);
  appendSeparator(bar);
  appendNumberFormatSelector(bar, ydoc, callbacks);
  appendSeparator(bar);
  appendBorderButtons(bar, ydoc, callbacks);

  container.appendChild(bar);
  return bar;
}

/** Update toolbar button states to reflect the active cell's format. */
export function updateToolbarState(
  toolbar: HTMLElement,
  fmt: CellFormat | undefined,
): void {
  toolbar.querySelectorAll<HTMLButtonElement>('[data-fmt-toggle]').forEach((btn) => {
    const prop = btn.dataset.fmtToggle as keyof CellFormat;
    btn.classList.toggle('active', !!fmt?.[prop]);
  });

  const sizeSelect = toolbar.querySelector<HTMLSelectElement>('[data-fmt-fontsize]');
  if (sizeSelect) sizeSelect.value = String(fmt?.fontSize || '');

  const numFmt = toolbar.querySelector<HTMLSelectElement>('[data-fmt-numformat]');
  if (numFmt) numFmt.value = fmt?.numberFormat || 'general';

  toolbar.querySelectorAll<HTMLButtonElement>('[data-fmt-align]').forEach((btn) => {
    btn.classList.toggle('active', fmt?.alignment === btn.dataset.fmtAlign);
  });
}

function appendSeparator(bar: HTMLElement): void {
  const sep = document.createElement('div');
  sep.className = 'format-separator';
  bar.appendChild(sep);
}
