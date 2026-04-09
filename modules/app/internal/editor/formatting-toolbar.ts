/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { t, onLocaleChange, type TranslationKey } from '../i18n/index.ts';
import { openImagePicker } from './image-handlers.ts';
import { setupToolbarOverflow } from './toolbar-overflow.ts';
import { printDocument, exportPdf } from '../shared/print-utils.ts';
import './page-break.ts';
import { isSuggesting, setSuggesting } from './suggestions/suggest-mode.ts';
import { announce } from '../shared/a11y-announcer.ts';
import { enableToolbarNavigation, updateRovingTabindex } from './toolbar-nav.ts';
import { openShortcutDialog } from '../shared/shortcut-dialog.ts';
import { getIcon } from './toolbar-icons.ts';

interface ToolbarButton {
  key: TranslationKey | null;
  /** Icon name from toolbar-icons.ts */
  icon?: string;
  /** Tooltip key — shown as the button's title attribute. Falls back to ariaKey then key. */
  titleKey?: TranslationKey;
  ariaKey?: TranslationKey;
  action: (btn?: HTMLButtonElement) => boolean | void;
  isActive?: () => boolean;
  announceOnKey?: TranslationKey;
  announceOffKey?: TranslationKey;
  /** If true, the button element is passed to action() as the first argument. */
  passSelf?: boolean;
}

function buildToolbarButtons(editor: Editor): ToolbarButton[] {
  return [
    { key: 'toolbar.bold', icon: 'bold', ariaKey: 'a11y.boldLabel', titleKey: 'shortcuts.bold', action: () => editor.chain().focus().toggleBold().run(), isActive: () => editor.isActive('bold'), announceOnKey: 'a11y.boldOn', announceOffKey: 'a11y.boldOff' },
    { key: 'toolbar.italic', icon: 'italic', ariaKey: 'a11y.italicLabel', titleKey: 'shortcuts.italic', action: () => editor.chain().focus().toggleItalic().run(), isActive: () => editor.isActive('italic'), announceOnKey: 'a11y.italicOn', announceOffKey: 'a11y.italicOff' },
    { key: 'toolbar.strike', icon: 'strikethrough', ariaKey: 'a11y.strikeLabel', titleKey: 'shortcuts.strikethrough', action: () => editor.chain().focus().toggleStrike().run(), isActive: () => editor.isActive('strike'), announceOnKey: 'a11y.strikeOn', announceOffKey: 'a11y.strikeOff' },
    { key: 'toolbar.code', icon: 'inlineCode', ariaKey: 'a11y.codeLabel', titleKey: 'shortcuts.code', action: () => editor.chain().focus().toggleCode().run(), isActive: () => editor.isActive('code'), announceOnKey: 'a11y.codeOn', announceOffKey: 'a11y.codeOff' },
    { key: null, action: () => false },
    { key: 'toolbar.heading1', icon: 'heading1', ariaKey: 'a11y.heading1Label', titleKey: 'shortcuts.heading1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: () => editor.isActive('heading', { level: 1 }) },
    { key: 'toolbar.heading2', icon: 'heading2', ariaKey: 'a11y.heading2Label', titleKey: 'shortcuts.heading2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: () => editor.isActive('heading', { level: 2 }) },
    { key: 'toolbar.heading3', icon: 'heading3', ariaKey: 'a11y.heading3Label', titleKey: 'shortcuts.heading3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: () => editor.isActive('heading', { level: 3 }) },
    { key: null, action: () => false },
    { key: 'toolbar.bulletList', icon: 'bulletList', ariaKey: 'a11y.bulletListLabel', titleKey: 'shortcuts.bulletList', action: () => editor.chain().focus().toggleBulletList().run(), isActive: () => editor.isActive('bulletList') },
    { key: 'toolbar.orderedList', icon: 'orderedList', ariaKey: 'a11y.orderedListLabel', titleKey: 'shortcuts.orderedList', action: () => editor.chain().focus().toggleOrderedList().run(), isActive: () => editor.isActive('orderedList') },
    { key: 'toolbar.blockquote', icon: 'blockquote', ariaKey: 'a11y.blockquoteLabel', titleKey: 'shortcuts.blockquote', action: () => editor.chain().focus().toggleBlockquote().run(), isActive: () => editor.isActive('blockquote') },
    { key: 'toolbar.codeBlock', icon: 'codeBlock', ariaKey: 'a11y.codeBlockLabel', titleKey: 'shortcuts.codeBlock', action: () => editor.chain().focus().toggleCodeBlock().run(), isActive: () => editor.isActive('codeBlock') },
    { key: 'toolbar.horizontalRule', icon: 'horizontalRule', ariaKey: 'a11y.horizontalRuleLabel', titleKey: 'shortcuts.horizontalRule', action: () => editor.chain().focus().setHorizontalRule().run() },
    { key: null, action: () => false },
    { key: 'table.insert', icon: 'table', ariaKey: 'a11y.tableLabel', action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { key: 'toolbar.image', icon: 'image', ariaKey: 'a11y.imageLabel', action: () => { openImagePicker(editor); return true; } },
    { key: 'toolbar.emoji', icon: 'emoji', action: () => { document.dispatchEvent(new CustomEvent('opendesk:open-emoji')); return true; } },
    { key: null, action: () => false },
    { key: 'toolbar.find', icon: 'search', ariaKey: 'a11y.findLabel', titleKey: 'shortcuts.findReplace', action: () => { document.dispatchEvent(new CustomEvent('opendesk:open-search')); return true; } },
    { key: 'toolbar.comment', icon: 'comment', ariaKey: 'a11y.commentLabel', titleKey: 'shortcuts.addComment', action: () => { document.dispatchEvent(new CustomEvent('opendesk:add-comment')); return true; } },
    { key: 'toolbar.suggest', icon: 'suggest', action: () => { setSuggesting(!isSuggesting()); return true; }, isActive: () => isSuggesting() },
    { key: null, action: () => false },
    { key: 'toolbar.pageBreak', icon: 'pageBreak', action: () => editor.chain().focus().insertPageBreak().run() },
    { key: null, action: () => false },
    { key: 'toolbar.toc', icon: 'toc', ariaKey: 'toc.title' as TranslationKey, action: () => { document.dispatchEvent(new CustomEvent('opendesk:toggle-toc')); return true; } },
    { key: null, action: () => false },
    { key: 'toolbar.print', icon: 'print', action: () => { printDocument(); return true; } },
    { key: 'toolbar.pdf', icon: 'pdf', action: (btn?: HTMLButtonElement) => { exportPdf(btn); return true; }, passSelf: true },
    { key: null, action: () => false },
    { key: 'toolbar.references', icon: 'references', action: () => { document.dispatchEvent(new CustomEvent('opendesk:toggle-reference-library')); return true; } },
    { key: 'toolbar.versions', icon: 'versions', action: () => { document.dispatchEvent(new CustomEvent('opendesk:toggle-versions')); return true; } },
    { key: 'toolbar.workflows', action: () => { document.dispatchEvent(new CustomEvent('opendesk:toggle-workflows')); return true; } },
    { key: null, action: () => false },
    { key: 'toolbar.saveToKb', action: () => { document.dispatchEvent(new CustomEvent('opendesk:promote-to-kb')); return true; } },
  ];
}

function buildButtonTitle(btnDef: ToolbarButton): string {
  const { titleKey, ariaKey, key } = btnDef;
  if (titleKey) return t(titleKey);
  if (ariaKey) return t(ariaKey);
  if (key) return t(key);
  return '';
}

function renderToolbarButtons(
  toolbar: HTMLElement, buttons: ToolbarButton[], editor: Editor,
): void {
  for (const btnDef of buttons) {
    const { key, icon, ariaKey, action, isActive } = btnDef;
    if (key === null) {
      const sep = document.createElement('span');
      sep.className = 'toolbar-separator';
      sep.setAttribute('role', 'separator');
      toolbar.appendChild(sep);
      continue;
    }
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn';
    btn.setAttribute('data-i18n-key', key);

    const iconSvg = icon ? getIcon(icon) : '';
    const labelText = t(key);
    const titleText = buildButtonTitle(btnDef);

    if (iconSvg) {
      // Icon mode: render SVG + visually-hidden label span
      btn.classList.add('toolbar-btn--icon');
      btn.innerHTML = iconSvg + `<span class="toolbar-btn-label">${labelText}</span>`;
    } else {
      btn.textContent = labelText;
    }

    if (titleText) btn.setAttribute('title', titleText);
    const ariaLabel = ariaKey ? t(ariaKey) : titleText || labelText;
    btn.setAttribute('aria-label', ariaLabel);

    if (isActive) btn.setAttribute('aria-pressed', String(isActive()));
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      btnDef.passSelf ? action(btn) : action();
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
  btn.className = 'toolbar-btn toolbar-btn--icon';
  btn.setAttribute('aria-label', t('a11y.shortcutsLabel'));
  btn.setAttribute('title', t('shortcuts.showShortcuts'));
  btn.innerHTML = getIcon('shortcuts') + `<span class="toolbar-btn-label">?</span>`;
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
