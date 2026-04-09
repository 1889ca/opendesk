/** Contract: contracts/app/rules.md */
/**
 * toolbar-color-btn — builds the text color button widget for the formatting toolbar.
 */
import type { Editor } from '@tiptap/core';
import { buildColorPalette } from './color-palette.ts';
import { svg } from './toolbar-icons-text.ts';

const colorAIcon = svg(
  '<text x="8" y="11" text-anchor="middle" font-size="11" font-weight="700" font-family="serif" fill="currentColor">A</text>' +
  '<rect x="3" y="13" width="10" height="2" rx="1" fill="var(--color-bar-color, currentColor)"/>',
);

export function buildTextColorBtn(editor: Editor): HTMLElement {
  const group = document.createElement('div');
  group.className = 'toolbar-color-group';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'toolbar-btn toolbar-btn--icon toolbar-color-btn';
  btn.setAttribute('aria-label', 'Text color');
  btn.setAttribute('title', 'Text color');
  btn.innerHTML = colorAIcon + '<span class="toolbar-btn-label">Color</span>';

  // The color bar is the rect inside the SVG — we update its fill via CSS custom property
  // by setting a data attribute and targeting it in CSS.
  // Simpler: just find the rect and update fill directly.
  const updateBar = () => {
    const rect = btn.querySelector('rect') as SVGRectElement | null;
    if (!rect) return;
    const attrs = editor.getAttributes('textColor');
    const color = (attrs.color as string | undefined) ?? '';
    rect.setAttribute('fill', color || 'currentColor');
  };

  editor.on('selectionUpdate', updateBar);
  editor.on('transaction', updateBar);

  let paletteEl: HTMLElement | null = null;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // If palette is already open, close it
    if (paletteEl && paletteEl.isConnected) {
      paletteEl.remove();
      paletteEl = null;
      return;
    }

    paletteEl = buildColorPalette((color) => {
      if (color) {
        editor.chain().focus().setTextColor(color).run();
      } else {
        editor.chain().focus().unsetTextColor().run();
      }
      updateBar();
      paletteEl = null;
    });

    // Position just below the button
    const rect = btn.getBoundingClientRect();
    paletteEl.style.top = `${rect.bottom + window.scrollY + 4}px`;
    paletteEl.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(paletteEl);
  });

  group.appendChild(btn);
  return group;
}
