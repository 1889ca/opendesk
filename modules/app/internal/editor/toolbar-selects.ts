/** Contract: contracts/app/rules.md */
/**
 * Toolbar select widgets: font family, font size and line height.
 * Paragraph style and paragraph spacing selects are in toolbar-style-select.ts.
 */
import type { Editor } from '@tiptap/core';
import { t } from '../i18n/index.ts';
import { FONT_SIZES } from './font-size.ts';
import { LINE_HEIGHTS } from './line-height.ts';
import { FONT_FAMILIES } from './font-family.ts';
import { batchRaf } from './lifecycle.ts';

export { buildStyleSelect, buildParagraphSpacingSelect } from './toolbar-style-select.ts';

/** Wrap an updateValue function with batched rAF and register on editor events. */
function bindSelectToEditor(
  editor: Editor,
  updateValue: () => void,
): () => void {
  const batched = batchRaf(updateValue);
  editor.on('selectionUpdate', batched.call);
  editor.on('transaction', batched.call);
  return () => {
    batched.cancel();
    editor.off('selectionUpdate', batched.call);
    editor.off('transaction', batched.call);
  };
}

const LINE_HEIGHT_LABELS: Record<string, string> = {
  '1': 'Single',
  '1.15': '1.15',
  '1.5': '1.5',
  '2': 'Double',
  '2.5': '2.5',
  '3': 'Triple',
};

export function buildFontFamilySelect(editor: Editor): { el: HTMLElement; cleanup: () => void } {
  const select = document.createElement('select');
  select.className = 'toolbar-select toolbar-select--font';
  select.setAttribute('aria-label', t('a11y.fontFamilyLabel'));
  select.setAttribute('title', t('toolbar.fontFamily'));

  for (const family of FONT_FAMILIES) {
    const option = document.createElement('option');
    option.value = family.value;
    option.textContent = family.label;
    select.appendChild(option);
  }

  select.addEventListener('change', () => {
    if (select.value) {
      editor.chain().focus().setFontFamily(select.value).run();
    } else {
      editor.chain().focus().unsetFontFamily().run();
    }
  });

  const updateValue = () => {
    const attrs = editor.getAttributes('fontFamily');
    select.value = (attrs.fontFamily as string | undefined) ?? '';
  };

  return { el: select, cleanup: bindSelectToEditor(editor, updateValue) };
}

export function buildFontSizeSelect(editor: Editor): { el: HTMLElement; cleanup: () => void } {
  const wrapper = document.createElement('span');
  wrapper.style.position = 'relative';
  wrapper.setAttribute('data-i18n-key', 'toolbar.fontSize');

  const datalist = document.createElement('datalist');
  datalist.id = 'font-size-options';
  for (const size of FONT_SIZES) {
    const option = document.createElement('option');
    option.value = size;
    datalist.appendChild(option);
  }

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'toolbar-select toolbar-select--size';
  input.setAttribute('aria-label', t('a11y.fontSizeLabel'));
  input.setAttribute('title', t('toolbar.fontSize'));
  input.setAttribute('min', '6');
  input.setAttribute('max', '96');
  input.setAttribute('step', '1');
  input.setAttribute('list', 'font-size-options');
  input.value = '14';

  input.addEventListener('change', () => {
    editor.chain().focus().setFontSize(String(input.value)).run();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      editor.chain().focus().setFontSize(String(input.value)).run();
      editor.commands.focus();
    }
    if (e.key === 'Escape') {
      const attrs = editor.getAttributes('fontSize');
      input.value = (attrs.fontSize as string | undefined) ?? '14';
      editor.commands.focus();
    }
  });

  const updateValue = () => {
    const attrs = editor.getAttributes('fontSize');
    input.value = (attrs.fontSize as string | undefined) ?? '14';
  };

  wrapper.appendChild(datalist);
  wrapper.appendChild(input);

  return { el: wrapper, cleanup: bindSelectToEditor(editor, updateValue) };
}

export function buildLineHeightSelect(editor: Editor): { el: HTMLElement; cleanup: () => void } {
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

  return { el: select, cleanup: bindSelectToEditor(editor, updateValue) };
}
