/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { t, onLocaleChange, type TranslationKey } from './i18n/index.ts';
import { openImagePicker } from './image-handlers.ts';
import { setupToolbarOverflow } from './toolbar-overflow.ts';
import { printDocument, exportPdf } from './print-utils.ts';
import './page-break.ts';
import { isSuggesting, setSuggesting } from './suggestions/suggest-mode.ts';
import { announce } from './a11y-announcer.ts';
import { enableToolbarNavigation, updateRovingTabindex } from './toolbar-nav.ts';
import { openShortcutDialog } from './shortcut-dialog.ts';

interface ToolbarButton {
  key: TranslationKey | null;
  ariaKey?: TranslationKey;
  action: () => boolean | void;
  isActive?: () => boolean;
  announceOnKey?: TranslationKey;
  announceOffKey?: TranslationKey;
}

function buildToolbarButtons(editor: Editor): ToolbarButton[] {
  return [
    { key: 'toolbar.bold', ariaKey: 'a11y.boldLabel', action: () => editor.chain().focus().toggleBold().run(), isActive: () => editor.isActive('bold'), announceOnKey: 'a11y.boldOn', announceOffKey: 'a11y.boldOff' },
    { key: 'toolbar.italic', ariaKey: 'a11y.italicLabel', action: () => editor.chain().focus().toggleItalic().run(), isActive: () => editor.isActive('italic'), announceOnKey: 'a11y.italicOn', announceOffKey: 'a11y.italicOff' },
    { key: 'toolbar.strike', ariaKey: 'a11y.strikeLabel', action: () => editor.chain().focus().toggleStrike().run(), isActive: () => editor.isActive('strike'), announceOnKey: 'a11y.strikeOn', announceOffKey: 'a11y.strikeOff' },
    { key: 'toolbar.code', ariaKey: 'a11y.codeLabel', action: () => editor.chain().focus().toggleCode().run(), isActive: () => editor.isActive('code'), announceOnKey: 'a11y.codeOn', announceOffKey: 'a11y.codeOff' },
    { key: null, action: () => false },
    { key: 'toolbar.heading1', ariaKey: 'a11y.heading1Label', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: () => editor.isActive('heading', { level: 1 }) },
    { key: 'toolbar.heading2', ariaKey: 'a11y.heading2Label', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: () => editor.isActive('heading', { level: 2 }) },
    { key: 'toolbar.heading3', ariaKey: 'a11y.heading3Label', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: () => editor.isActive('heading', { level: 3 }) },
    { key: null, action: () => false },
    { key: 'toolbar.bulletList', ariaKey: 'a11y.bulletListLabel', action: () => editor.chain().focus().toggleBulletList().run(), isActive: () => editor.isActive('bulletList') },
    { key: 'toolbar.orderedList', ariaKey: 'a11y.orderedListLabel', action: () => editor.chain().focus().toggleOrderedList().run(), isActive: () => editor.isActive('orderedList') },
    { key: 'toolbar.blockquote', ariaKey: 'a11y.blockquoteLabel', action: () => editor.chain().focus().toggleBlockquote().run(), isActive: () => editor.isActive('blockquote') },
    { key: 'toolbar.codeBlock', ariaKey: 'a11y.codeBlockLabel', action: () => editor.chain().focus().toggleCodeBlock().run(), isActive: () => editor.isActive('codeBlock') },
    { key: 'toolbar.horizontalRule', ariaKey: 'a11y.horizontalRuleLabel', action: () => editor.chain().focus().setHorizontalRule().run() },
    { key: null, action: () => false },
    { key: 'table.insert', ariaKey: 'a11y.tableLabel', action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { key: 'toolbar.image', ariaKey: 'a11y.imageLabel', action: () => { openImagePicker(editor); return true; } },
    { key: null, action: () => false },
    { key: 'toolbar.find', ariaKey: 'a11y.findLabel', action: () => { document.dispatchEvent(new CustomEvent('opendesk:open-search')); return true; } },
    { key: 'toolbar.comment', ariaKey: 'a11y.commentLabel', action: () => { document.dispatchEvent(new CustomEvent('opendesk:add-comment')); return true; } },
    { key: 'toolbar.suggest', action: () => { setSuggesting(!isSuggesting()); return true; }, isActive: () => isSuggesting() },
    { key: null, action: () => false },
    { key: 'toolbar.pageBreak', action: () => editor.chain().focus().insertPageBreak().run() },
    { key: null, action: () => false },
    { key: 'toolbar.print', action: () => { printDocument(); return true; } },
    { key: 'toolbar.pdf', action: () => { exportPdf(); return true; } },
    { key: null, action: () => false },
    { key: 'toolbar.versions', action: () => { document.dispatchEvent(new CustomEvent('opendesk:toggle-versions')); return true; } },
  ];
}

function renderToolbarButtons(
  toolbar: HTMLElement, buttons: ToolbarButton[], editor: Editor,
): void {
  for (const btnDef of buttons) {
    const { key, ariaKey, action, isActive } = btnDef;
    if (key === null) {
      const sep = document.createElement('span');
      sep.className = 'toolbar-separator';
      sep.setAttribute('role', 'separator');
      toolbar.appendChild(sep);
      continue;
    }
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn';
    btn.textContent = t(key);
    btn.setAttribute('data-i18n-key', key);
    if (ariaKey) btn.setAttribute('aria-label', t(ariaKey));
    if (isActive) btn.setAttribute('aria-pressed', String(isActive()));
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      action();
      if (isActive && btnDef.announceOnKey && btnDef.announceOffKey) {
        const active = isActive();
        btn.setAttribute('aria-pressed', String(active));
        announce(t(active ? btnDef.announceOnKey : btnDef.announceOffKey));
      }
    });
    toolbar.appendChild(btn);
    if (isActive) {
      const update = () => {
        const active = isActive();
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
      };
      editor.on('selectionUpdate', update);
      editor.on('transaction', update);
    }
  }
}

function addShortcutButton(toolbar: HTMLElement): void {
  const sep = document.createElement('span');
  sep.className = 'toolbar-separator';
  sep.setAttribute('role', 'separator');
  toolbar.appendChild(sep);
  const btn = document.createElement('button');
  btn.className = 'toolbar-btn';
  btn.textContent = '?';
  btn.setAttribute('aria-label', t('a11y.shortcutsLabel'));
  btn.addEventListener('click', (e) => { e.preventDefault(); openShortcutDialog(); });
  toolbar.appendChild(btn);
}

/** Build the main formatting toolbar with all editor actions. */
export function buildFormattingToolbar(editor: Editor): void {
  const toolbar = document.getElementById('formatting-toolbar');
  if (!toolbar) return;
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', t('a11y.formattingToolbar'));
  const editorEl = () => document.querySelector('.editor-content') as HTMLElement | null;
  const render = () => {
    toolbar.innerHTML = '';
    renderToolbarButtons(toolbar, buildToolbarButtons(editor), editor);
    addShortcutButton(toolbar);
    updateRovingTabindex(toolbar);
  };
  render();
  setupToolbarOverflow(toolbar);
  document.addEventListener('opendesk:suggest-mode-changed', render);
  enableToolbarNavigation(toolbar, editorEl);
  onLocaleChange(() => { toolbar.setAttribute('aria-label', t('a11y.formattingToolbar')); render(); });
}
