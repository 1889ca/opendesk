/** Contract: contracts/app/rules.md */
/**
 * Toolbar select widgets: font family, font size and line height.
 * Extracted to keep formatting-toolbar.ts under the 200-line limit.
 */
import type { Editor } from '@tiptap/core';
import { t } from '../i18n/index.ts';
import { FONT_SIZES } from './font-size.ts';
import { LINE_HEIGHTS } from './line-height.ts';
import { FONT_FAMILIES } from './font-family.ts';
import { buildStylePicker } from './style-picker.ts';

const LINE_HEIGHT_LABELS: Record<string, string> = {
  '1': 'Single',
  '1.15': '1.15',
  '1.5': '1.5',
  '2': 'Double',
  '2.5': '2.5',
  '3': 'Triple',
};

export function buildFontFamilySelect(editor: Editor): HTMLElement {
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

  editor.on('selectionUpdate', updateValue);
  editor.on('transaction', updateValue);

  return select;
}

export function buildFontSizeSelect(editor: Editor): HTMLElement {
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

  editor.on('selectionUpdate', updateValue);
  editor.on('transaction', updateValue);

  wrapper.appendChild(datalist);
  wrapper.appendChild(input);
  return wrapper;
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

export function buildStyleSelect(editor: Editor): HTMLElement {
  return buildStylePicker(editor);
}

const PARA_SPACINGS = [
  { label: 'Compact', value: '0.25rem' },
  { label: 'Normal', value: '0.5rem' },
  { label: 'Relaxed', value: '1rem' },
  { label: 'Spacious', value: '1.5rem' },
];
const PARA_SPACING_KEY = 'opendesk-para-spacing';

export function buildParagraphSpacingSelect(_editor: Editor): HTMLElement {
  const select = document.createElement('select');
  select.className = 'toolbar-select';
  select.setAttribute('aria-label', 'Paragraph spacing');
  select.setAttribute('title', 'Paragraph spacing');

  for (const s of PARA_SPACINGS) {
    const opt = document.createElement('option');
    opt.value = s.value;
    opt.textContent = s.label;
    select.appendChild(opt);
  }

  function applySpacing(v: string): void {
    document.documentElement.style.setProperty('--editor-para-spacing', v);
  }

  const saved = localStorage.getItem(PARA_SPACING_KEY) || '0.5rem';
  select.value = saved;
  applySpacing(saved);

  select.addEventListener('change', () => {
    applySpacing(select.value);
    localStorage.setItem(PARA_SPACING_KEY, select.value);
  });

  return select;
}
