/** Contract: contracts/app/rules.md */
/**
 * Paragraph-style and paragraph-spacing toolbar selects.
 * Extracted from toolbar-selects.ts to keep that file under the 200-line limit.
 */
import type { Editor } from '@tiptap/core';
import { t as _t } from '../i18n/index.ts';

const STYLES = [
  { label: 'Normal', action: (editor: Editor) => editor.chain().focus().setParagraph().run(), isActive: (editor: Editor) => !editor.isActive('heading') && !editor.isActive('codeBlock') },
  { label: 'Heading 1', action: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: (editor: Editor) => editor.isActive('heading', { level: 1 }) },
  { label: 'Heading 2', action: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: (editor: Editor) => editor.isActive('heading', { level: 2 }) },
  { label: 'Heading 3', action: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: (editor: Editor) => editor.isActive('heading', { level: 3 }) },
  { label: 'Heading 4', action: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 4 }).run(), isActive: (editor: Editor) => editor.isActive('heading', { level: 4 }) },
  { label: 'Heading 5', action: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 5 }).run(), isActive: (editor: Editor) => editor.isActive('heading', { level: 5 }) },
  { label: 'Heading 6', action: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 6 }).run(), isActive: (editor: Editor) => editor.isActive('heading', { level: 6 }) },
  { label: 'Code Block', action: (editor: Editor) => editor.chain().focus().toggleCodeBlock().run(), isActive: (editor: Editor) => editor.isActive('codeBlock') },
];

export function buildStyleSelect(editor: Editor): HTMLElement {
  const select = document.createElement('select');
  select.className = 'toolbar-select toolbar-select--style';
  select.setAttribute('aria-label', 'Paragraph style');
  select.setAttribute('title', 'Paragraph style');

  for (const style of STYLES) {
    const opt = document.createElement('option');
    opt.value = style.label;
    opt.textContent = style.label;
    select.appendChild(opt);
  }

  select.addEventListener('change', () => {
    const style = STYLES.find((s) => s.label === select.value);
    if (style) style.action(editor);
  });

  const updateValue = () => {
    const active = STYLES.find((s) => s.isActive(editor));
    select.value = active ? active.label : 'Normal';
  };

  editor.on('selectionUpdate', updateValue);
  editor.on('transaction', updateValue);
  updateValue();

  return select;
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
