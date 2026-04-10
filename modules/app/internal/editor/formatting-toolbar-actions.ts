/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { t, type TranslationKey } from '../i18n/index.ts';
import { openImagePicker } from './image-handlers.ts';
import { openDrawingDialog } from './drawing/index.ts';
import { isSuggesting, setSuggesting } from './suggestions/suggest-mode.ts';
import { showTableGridPicker } from './table-grid-picker.ts';
import { printDocument, exportPdf } from '../shared/print-utils.ts';

export interface ToolbarButton {
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
  /** 'overflow' = permanently lives in the More (···) menu, never in the primary toolbar. */
  priority?: 'overflow';
}

export function buildToolbarButtons(editor: Editor): ToolbarButton[] {
  return [
    // ── PRIMARY: Undo / Redo ──────────────────────────────────────────
    { key: 'toolbar.undo', icon: 'undo', ariaKey: 'a11y.undoLabel', titleKey: 'shortcuts.undo', action: () => editor.chain().focus().undo().run() },
    { key: 'toolbar.redo', icon: 'redo', ariaKey: 'a11y.redoLabel', titleKey: 'shortcuts.redo', action: () => editor.chain().focus().redo().run() },
    { key: null, action: () => false },
    // ── PRIMARY: Core text formatting ────────────────────────────────
    { key: 'toolbar.bold', icon: 'bold', ariaKey: 'a11y.boldLabel', titleKey: 'shortcuts.bold', action: () => editor.chain().focus().toggleBold().run(), isActive: () => editor.isActive('bold'), announceOnKey: 'a11y.boldOn', announceOffKey: 'a11y.boldOff' },
    { key: 'toolbar.italic', icon: 'italic', ariaKey: 'a11y.italicLabel', titleKey: 'shortcuts.italic', action: () => editor.chain().focus().toggleItalic().run(), isActive: () => editor.isActive('italic'), announceOnKey: 'a11y.italicOn', announceOffKey: 'a11y.italicOff' },
    { key: 'toolbar.underline', icon: 'underline', ariaKey: 'a11y.underlineLabel', titleKey: 'shortcuts.underline', action: () => editor.chain().focus().toggleUnderline().run(), isActive: () => editor.isActive('underline'), announceOnKey: 'a11y.underlineOn', announceOffKey: 'a11y.underlineOff' },
    { key: 'toolbar.strike', icon: 'strikethrough', ariaKey: 'a11y.strikeLabel', titleKey: 'shortcuts.strikethrough', action: () => editor.chain().focus().toggleStrike().run(), isActive: () => editor.isActive('strike'), announceOnKey: 'a11y.strikeOn', announceOffKey: 'a11y.strikeOff' },
    { key: null, action: () => false },
    // ── PRIMARY: Alignment ───────────────────────────────────────────
    { key: 'toolbar.alignLeft', icon: 'alignLeft', ariaKey: 'a11y.alignLeftLabel', action: () => editor.chain().focus().setTextAlign('left').run(), isActive: () => editor.isActive({ textAlign: 'left' }) || (!editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'right' }) && !editor.isActive({ textAlign: 'justify' })) },
    { key: 'toolbar.alignCenter', icon: 'alignCenter', ariaKey: 'a11y.alignCenterLabel', action: () => editor.chain().focus().setTextAlign('center').run(), isActive: () => editor.isActive({ textAlign: 'center' }) },
    { key: 'toolbar.alignRight', icon: 'alignRight', ariaKey: 'a11y.alignRightLabel', action: () => editor.chain().focus().setTextAlign('right').run(), isActive: () => editor.isActive({ textAlign: 'right' }) },
    { key: 'toolbar.alignJustify', icon: 'alignJustify', ariaKey: 'a11y.alignJustifyLabel', action: () => editor.chain().focus().setTextAlign('justify').run(), isActive: () => editor.isActive({ textAlign: 'justify' }) },
    { key: null, action: () => false },
    // ── PRIMARY: Lists ────────────────────────────────────────────────
    { key: 'toolbar.bulletList', icon: 'bulletList', ariaKey: 'a11y.bulletListLabel', titleKey: 'shortcuts.bulletList', action: () => editor.chain().focus().toggleBulletList().run(), isActive: () => editor.isActive('bulletList') },
    { key: 'toolbar.orderedList', icon: 'orderedList', ariaKey: 'a11y.orderedListLabel', titleKey: 'shortcuts.orderedList', action: () => editor.chain().focus().toggleOrderedList().run(), isActive: () => editor.isActive('orderedList') },
    { key: null, action: () => false },
    // ── PRIMARY: Link ─────────────────────────────────────────────────
    { key: 'toolbar.link', icon: 'link', ariaKey: 'a11y.linkLabel', titleKey: 'shortcuts.link', action: (btn?: HTMLButtonElement) => { document.dispatchEvent(new CustomEvent('opendesk:open-link-popover', { detail: { anchor: btn } })); return true; }, passSelf: true, isActive: () => editor.isActive('link') },
    { key: null, action: () => false },
    // ── PRIMARY: Comment ──────────────────────────────────────────────
    { key: 'toolbar.comment', icon: 'comment', ariaKey: 'a11y.commentLabel', titleKey: 'shortcuts.addComment', action: () => { document.dispatchEvent(new CustomEvent('opendesk:add-comment')); return true; } },

    // ══ OVERFLOW items below — live in the More (···) menu ════════════
    // ── Format extras ─────────────────────────────────────────────────
    { key: 'toolbar.code', icon: 'inlineCode', ariaKey: 'a11y.codeLabel', titleKey: 'shortcuts.code', action: () => editor.chain().focus().toggleCode().run(), isActive: () => editor.isActive('code'), announceOnKey: 'a11y.codeOn', announceOffKey: 'a11y.codeOff', priority: 'overflow' },
    { key: 'toolbar.superscript', icon: 'superscript', ariaKey: 'a11y.superscriptLabel', titleKey: 'shortcuts.superscript', action: () => editor.chain().focus().toggleSuperscript().run(), isActive: () => editor.isActive('superscript'), priority: 'overflow' },
    { key: 'toolbar.subscript', icon: 'subscript', ariaKey: 'a11y.subscriptLabel', titleKey: 'shortcuts.subscript', action: () => editor.chain().focus().toggleSubscript().run(), isActive: () => editor.isActive('subscript'), priority: 'overflow' },
    { key: 'toolbar.clearFormatting', icon: 'clearFormatting', ariaKey: 'a11y.clearFormattingLabel', action: () => editor.chain().focus().clearNodes().unsetAllMarks().run(), priority: 'overflow' },
    // ── Headings ──────────────────────────────────────────────────────
    { key: null, action: () => false, priority: 'overflow' },
    { key: 'toolbar.heading1', icon: 'heading1', ariaKey: 'a11y.heading1Label', titleKey: 'shortcuts.heading1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: () => editor.isActive('heading', { level: 1 }), priority: 'overflow' },
    { key: 'toolbar.heading2', icon: 'heading2', ariaKey: 'a11y.heading2Label', titleKey: 'shortcuts.heading2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: () => editor.isActive('heading', { level: 2 }), priority: 'overflow' },
    { key: 'toolbar.heading3', icon: 'heading3', ariaKey: 'a11y.heading3Label', titleKey: 'shortcuts.heading3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: () => editor.isActive('heading', { level: 3 }), priority: 'overflow' },
    // ── Blocks & structure ────────────────────────────────────────────
    { key: null, action: () => false, priority: 'overflow' },
    { key: 'toolbar.blockquote', icon: 'blockquote', ariaKey: 'a11y.blockquoteLabel', titleKey: 'shortcuts.blockquote', action: () => editor.chain().focus().toggleBlockquote().run(), isActive: () => editor.isActive('blockquote'), priority: 'overflow' },
    { key: 'toolbar.codeBlock', icon: 'codeBlock', ariaKey: 'a11y.codeBlockLabel', titleKey: 'shortcuts.codeBlock', action: () => editor.chain().focus().toggleCodeBlock().run(), isActive: () => editor.isActive('codeBlock'), priority: 'overflow' },
    { key: 'toolbar.horizontalRule', icon: 'horizontalRule', ariaKey: 'a11y.horizontalRuleLabel', titleKey: 'shortcuts.horizontalRule', action: () => editor.chain().focus().setHorizontalRule().run(), priority: 'overflow' },
    { key: 'toolbar.indent', icon: 'indent', ariaKey: 'a11y.indentLabel', action: () => editor.chain().focus().sinkListItem('listItem').run(), priority: 'overflow' },
    { key: 'toolbar.outdent', icon: 'outdent', ariaKey: 'a11y.outdentLabel', action: () => editor.chain().focus().liftListItem('listItem').run(), priority: 'overflow' },
    // ── Insert ────────────────────────────────────────────────────────
    { key: null, action: () => false, priority: 'overflow' },
    { key: 'toolbar.image', icon: 'image', ariaKey: 'a11y.imageLabel', action: () => { openImagePicker(editor); return true; }, priority: 'overflow' },
    { key: 'table.insert', icon: 'table', ariaKey: 'a11y.tableLabel', passSelf: true, action: (btn?: HTMLButtonElement) => { if (btn) showTableGridPicker(editor, btn); return true; }, priority: 'overflow' },
    { key: 'toolbar.drawing', icon: 'drawing', ariaKey: 'a11y.drawingLabel', action: () => { openDrawingDialog().then((svg) => { if (svg) editor.chain().focus().insertDrawing(svg).run(); }); return true; }, priority: 'overflow' },
    { key: 'toolbar.spellcheck', icon: 'spellcheck', ariaKey: 'a11y.spellcheckLabel', action: () => { document.dispatchEvent(new CustomEvent('opendesk:spellcheck-cycle')); return true; }, priority: 'overflow' },
    { key: 'toolbar.emoji', icon: 'emoji', action: () => { document.dispatchEvent(new CustomEvent('opendesk:open-emoji')); return true; }, priority: 'overflow' },
    { key: 'toolbar.specialChars', icon: 'specialChars', action: () => { document.dispatchEvent(new CustomEvent('opendesk:toggle-special-chars')); return true; }, priority: 'overflow' },
    // ── Collaborate ───────────────────────────────────────────────────
    { key: null, action: () => false, priority: 'overflow' },
    { key: 'toolbar.find', icon: 'search', ariaKey: 'a11y.findLabel', titleKey: 'shortcuts.findReplace', action: () => { document.dispatchEvent(new CustomEvent('opendesk:open-search')); return true; }, priority: 'overflow' },
    { key: 'toolbar.suggest', icon: 'suggest', action: () => { setSuggesting(!isSuggesting()); return true; }, isActive: () => isSuggesting(), priority: 'overflow' },
    // ── Document ──────────────────────────────────────────────────────
    { key: null, action: () => false, priority: 'overflow' },
    { key: 'toolbar.pageBreak', icon: 'pageBreak', action: () => editor.chain().focus().insertPageBreak().run(), priority: 'overflow' },
    { key: 'toolbar.toc', icon: 'toc', ariaKey: 'toc.title' as TranslationKey, action: () => { document.dispatchEvent(new CustomEvent('opendesk:toggle-toc')); return true; }, priority: 'overflow' },
    { key: 'toolbar.print', icon: 'print', action: () => { printDocument(); return true; }, priority: 'overflow' },
    { key: 'toolbar.pdf', icon: 'pdf', action: (btn?: HTMLButtonElement) => { exportPdf(btn); return true; }, passSelf: true, priority: 'overflow' },
    // ── Advanced ──────────────────────────────────────────────────────
    { key: null, action: () => false, priority: 'overflow' },
    { key: 'toolbar.references', icon: 'references', action: () => { document.dispatchEvent(new CustomEvent('opendesk:toggle-reference-library')); return true; }, priority: 'overflow' },
    { key: 'toolbar.versions', icon: 'versions', action: () => { document.dispatchEvent(new CustomEvent('opendesk:toggle-versions')); return true; }, priority: 'overflow' },
    { key: 'toolbar.workflows', icon: 'workflows', action: () => { document.dispatchEvent(new CustomEvent('opendesk:toggle-workflows')); return true; }, priority: 'overflow' },
    { key: 'toolbar.saveToKb', icon: 'saveToKb', action: () => { document.dispatchEvent(new CustomEvent('opendesk:promote-to-kb')); return true; }, priority: 'overflow' },
    { key: 'toolbar.footnote', icon: 'footnote', action: () => { const text = prompt('Footnote text:'); if (text) editor.chain().focus().insertFootnote(text).run(); return true; }, priority: 'overflow' },
  ];
}

const _isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD   = _isMac ? '⌘' : 'Ctrl';
const ALT   = _isMac ? '⌥' : 'Alt';
const SHIFT = _isMac ? '⇧' : 'Shift';
export const KB_HINTS: Partial<Record<string, string>> = {
  'shortcuts.bold':           `${MOD}B`,
  'shortcuts.italic':         `${MOD}I`,
  'shortcuts.underline':      `${MOD}U`,
  'shortcuts.link':           `${MOD}K`,
  'shortcuts.strikethrough':  `${MOD}${SHIFT}X`,
  'shortcuts.code':           `${MOD}E`,
  'shortcuts.superscript':    `${MOD}.`,
  'shortcuts.subscript':      `${MOD},`,
  'shortcuts.heading1':       `${MOD}${ALT}1`,
  'shortcuts.heading2':       `${MOD}${ALT}2`,
  'shortcuts.heading3':       `${MOD}${ALT}3`,
  'shortcuts.bulletList':     `${MOD}${SHIFT}8`,
  'shortcuts.orderedList':    `${MOD}${SHIFT}7`,
  'shortcuts.blockquote':     `${MOD}${SHIFT}B`,
  'shortcuts.codeBlock':      `${MOD}${ALT}C`,
  'shortcuts.horizontalRule': `${MOD}${ALT}H`,
  'shortcuts.undo':           `${MOD}Z`,
  'shortcuts.redo':           `${MOD}${SHIFT}Z`,
  'shortcuts.findReplace':    `${MOD}${SHIFT}H`,
  'shortcuts.addComment':     `${MOD}${SHIFT}M`,
};

export function buildButtonTitle(btnDef: ToolbarButton): string {
  const { titleKey, ariaKey, key } = btnDef;
  const base = titleKey ? t(titleKey) : ariaKey ? t(ariaKey) : key ? t(key) : '';
  const hint = titleKey && KB_HINTS[titleKey];
  return hint ? `${base} (${hint})` : base;
}
