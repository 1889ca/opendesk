/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { t, onLocaleChange, type TranslationKey } from './i18n/index.ts';
import { openImagePicker } from './image-handlers.ts';

interface ToolbarButton {
  key: TranslationKey | null;
  action: () => boolean | void;
  isActive?: () => boolean;
}

function buildToolbarButtons(editor: Editor): ToolbarButton[] {
  return [
    { key: 'toolbar.bold', action: () => editor.chain().focus().toggleBold().run(), isActive: () => editor.isActive('bold') },
    { key: 'toolbar.italic', action: () => editor.chain().focus().toggleItalic().run(), isActive: () => editor.isActive('italic') },
    { key: 'toolbar.strike', action: () => editor.chain().focus().toggleStrike().run(), isActive: () => editor.isActive('strike') },
    { key: 'toolbar.code', action: () => editor.chain().focus().toggleCode().run(), isActive: () => editor.isActive('code') },
    { key: null, action: () => false },
    { key: 'toolbar.heading1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: () => editor.isActive('heading', { level: 1 }) },
    { key: 'toolbar.heading2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: () => editor.isActive('heading', { level: 2 }) },
    { key: 'toolbar.heading3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: () => editor.isActive('heading', { level: 3 }) },
    { key: null, action: () => false },
    { key: 'toolbar.bulletList', action: () => editor.chain().focus().toggleBulletList().run(), isActive: () => editor.isActive('bulletList') },
    { key: 'toolbar.orderedList', action: () => editor.chain().focus().toggleOrderedList().run(), isActive: () => editor.isActive('orderedList') },
    { key: 'toolbar.blockquote', action: () => editor.chain().focus().toggleBlockquote().run(), isActive: () => editor.isActive('blockquote') },
    { key: 'toolbar.codeBlock', action: () => editor.chain().focus().toggleCodeBlock().run(), isActive: () => editor.isActive('codeBlock') },
    { key: 'toolbar.horizontalRule', action: () => editor.chain().focus().setHorizontalRule().run() },
    { key: null, action: () => false },
    { key: 'table.insert', action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { key: 'toolbar.image', action: () => { openImagePicker(editor); return true; } },
    { key: null, action: () => false },
    { key: 'toolbar.find', action: () => { document.dispatchEvent(new CustomEvent('opendesk:open-search')); return true; } },
    { key: 'toolbar.comment', action: () => { document.dispatchEvent(new CustomEvent('opendesk:add-comment')); return true; } },
  ];
}

function renderToolbarButtons(
  toolbar: HTMLElement,
  buttons: ToolbarButton[],
  editor: Editor,
): void {
  for (const { key, action, isActive } of buttons) {
    if (key === null) {
      const sep = document.createElement('span');
      sep.className = 'toolbar-separator';
      toolbar.appendChild(sep);
      continue;
    }
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn';
    btn.textContent = t(key);
    btn.addEventListener('click', (e) => { e.preventDefault(); action(); });
    toolbar.appendChild(btn);

    if (isActive) {
      const update = () => btn.classList.toggle('is-active', isActive());
      editor.on('selectionUpdate', update);
      editor.on('transaction', update);
    }
  }
}

/** Build the main formatting toolbar with all editor actions. */
export function buildFormattingToolbar(editor: Editor): void {
  const toolbar = document.getElementById('formatting-toolbar');
  if (!toolbar) return;

  const render = () => {
    toolbar.innerHTML = '';
    const buttons = buildToolbarButtons(editor);
    renderToolbarButtons(toolbar, buttons, editor);
  };

  render();
  onLocaleChange(render);
}
