/** Contract: contracts/app/rules.md */
/**
 * Toolbar select widgets: font size and line height.
 * Extracted to keep formatting-toolbar.ts under the 200-line limit.
 */
import type { Editor } from '@tiptap/core';
import { t } from '../i18n/index.ts';
import { FONT_SIZES } from './font-size.ts';
import { LINE_HEIGHTS } from './line-height.ts';

const LINE_HEIGHT_LABELS: Record<string, string> = {
  '1': 'Single',
  '1.15': '1.15',
  '1.5': '1.5',
  '2': 'Double',
  '2.5': '2.5',
  '3': 'Triple',
};

export function buildFontSizeSelect(editor: Editor): HTMLElement {
  const select = document.createElement('select');
  select.className = 'toolbar-select';
  select.setAttribute('aria-label', t('a11y.fontSizeLabel'));
  select.setAttribute('title', t('toolbar.fontSize'));

  for (const size of FONT_SIZES) {
    const option = document.createElement('option');
    option.value = size;
    option.textContent = size;
    select.appendChild(option);
  }

  select.addEventListener('change', () => {
    editor.chain().focus().setFontSize(select.value).run();
  });

  const updateValue = () => {
    const attrs = editor.getAttributes('fontSize');
    select.value = (attrs.fontSize as string | undefined) ?? '';
  };

  editor.on('selectionUpdate', updateValue);
  editor.on('transaction', updateValue);

  return select;
}

export function buildLineHeightSelect(editor: Editor): HTMLElement {
  const select = document.createElement('select');
  select.className = 'toolbar-select';
  select.setAttribute('aria-label', t('a11y.lineHeightLabel'));
  select.setAttribute('title', t('toolbar.lineHeight'));

  for (const value of LINE_HEIGHTS) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = LINE_HEIGHT_LABELS[value] ?? value;
    select.appendChild(option);
  }

  select.addEventListener('change', () => {
    editor.chain().focus().setLineHeight(select.value).run();
  });

  const updateValue = () => {
    const attrs = editor.getAttributes('paragraph');
    select.value = (attrs.lineHeight as string | undefined) ?? '';
  };

  editor.on('selectionUpdate', updateValue);
  editor.on('transaction', updateValue);

  return select;
}
