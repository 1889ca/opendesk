/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { openImagePicker } from './image-handlers.ts';
import { openDrawingDialog } from './drawing/index.ts';
import { printDocument, exportPdf } from '../shared/print-utils.ts';
import { isSuggesting, setSuggesting } from './suggestions/suggest-mode.ts';

const _mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const M = _mac ? '\u2318' : 'Ctrl+';
const S = _mac ? '\u21e7' : 'Shift+';
const A = _mac ? '\u2325' : 'Alt+';

export interface MenuItem {
  label: string;
  icon?: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
}

export interface MenuDef {
  label: string;
  items: MenuItem[];
}

function emit(name: string, detail?: unknown): void {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

function click(id: string): void {
  document.getElementById(id)?.click();
}

export function buildMenuDefs(editor: Editor): MenuDef[] {
  return [
    { label: 'File', items: [
      { label: 'Import\u2026', action: () => click('import-file') },
      { separator: true, label: '' },
      { label: 'Export as HTML', action: () => click('export-html') },
      { label: 'Export as Text', action: () => click('export-text') },
      { label: 'Export as DOCX', action: () => click('export-docx') },
      { label: 'Export as ODT', action: () => click('export-odt') },
      { separator: true, label: '' },
      { label: 'Print', icon: 'print', shortcut: `${M}P`, action: () => printDocument() },
      { label: 'Export PDF', icon: 'pdf', action: () => exportPdf() },
      { separator: true, label: '' },
      { label: 'Save to Knowledge Base', icon: 'saveToKb', action: () => emit('opendesk:promote-to-kb') },
      { label: 'Version History', icon: 'versions', action: () => emit('opendesk:toggle-versions') },
    ]},
    { label: 'Edit', items: [
      { label: 'Undo', icon: 'undo', shortcut: `${M}Z`, action: () => editor.chain().focus().undo().run() },
      { label: 'Redo', icon: 'redo', shortcut: `${M}${S}Z`, action: () => editor.chain().focus().redo().run() },
      { separator: true, label: '' },
      { label: 'Find & Replace', icon: 'search', shortcut: `${M}${S}H`, action: () => emit('opendesk:open-search') },
      { separator: true, label: '' },
      { label: 'Spelling & Grammar', icon: 'spellcheck', action: () => emit('opendesk:spellcheck-cycle') },
    ]},
    { label: 'View', items: [
      { label: 'Table of Contents', icon: 'toc', action: () => emit('opendesk:toggle-toc') },
      { label: 'Comments', icon: 'comment', action: () => emit('opendesk:add-comment') },
      { label: 'Suggestions', icon: 'suggest', action: () => emit('opendesk:toggle-suggestions') },
      { separator: true, label: '' },
      { label: 'Page Setup\u2026', action: () => click('page-setup-btn') },
      { label: 'Toggle Ruler', action: () => click('ruler-toggle') },
      { separator: true, label: '' },
      { label: 'Zoom In', shortcut: `${M}+`, action: () => click('zoom-in') },
      { label: 'Zoom Out', shortcut: `${M}\u2212`, action: () => click('zoom-out') },
      { separator: true, label: '' },
      { label: 'Focus Mode', action: () => document.querySelector<HTMLButtonElement>('#focus-btn, [data-focus-mode]')?.click() },
    ]},
    { label: 'Insert', items: [
      { label: 'Image\u2026', icon: 'image', action: () => openImagePicker(editor) },
      { label: 'Table', icon: 'table', action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run() },
      { label: 'Drawing\u2026', icon: 'drawing', action: () => { openDrawingDialog().then(svg => { if (svg) editor.chain().focus().insertDrawing(svg).run(); }); } },
      { separator: true, label: '' },
      { label: 'Link\u2026', icon: 'link', shortcut: `${M}K`, action: () => emit('opendesk:open-link-popover') },
      { label: 'Footnote\u2026', icon: 'footnote', action: () => { const t = prompt('Footnote text:'); if (t) editor.chain().focus().insertFootnote(t).run(); } },
      { separator: true, label: '' },
      { label: 'Page Break', icon: 'pageBreak', action: () => editor.chain().focus().insertPageBreak().run() },
      { label: 'Horizontal Rule', icon: 'horizontalRule', action: () => editor.chain().focus().setHorizontalRule().run() },
      { separator: true, label: '' },
      { label: 'Emoji', icon: 'emoji', action: () => emit('opendesk:open-emoji') },
      { label: 'Special Characters', icon: 'specialChars', action: () => emit('opendesk:toggle-special-chars') },
      { separator: true, label: '' },
      { label: 'Code Block', icon: 'codeBlock', action: () => editor.chain().focus().toggleCodeBlock().run() },
      { label: 'Blockquote', icon: 'blockquote', action: () => editor.chain().focus().toggleBlockquote().run() },
    ]},
    { label: 'Format', items: [
      { label: 'Heading 1', icon: 'heading1', shortcut: `${M}${A}1`, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
      { label: 'Heading 2', icon: 'heading2', shortcut: `${M}${A}2`, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
      { label: 'Heading 3', icon: 'heading3', shortcut: `${M}${A}3`, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
      { separator: true, label: '' },
      { label: 'Bold', icon: 'bold', shortcut: `${M}B`, action: () => editor.chain().focus().toggleBold().run() },
      { label: 'Italic', icon: 'italic', shortcut: `${M}I`, action: () => editor.chain().focus().toggleItalic().run() },
      { label: 'Underline', icon: 'underline', shortcut: `${M}U`, action: () => editor.chain().focus().toggleUnderline().run() },
      { label: 'Strikethrough', icon: 'strikethrough', shortcut: `${M}${S}X`, action: () => editor.chain().focus().toggleStrike().run() },
      { separator: true, label: '' },
      { label: 'Inline Code', icon: 'inlineCode', shortcut: `${M}E`, action: () => editor.chain().focus().toggleCode().run() },
      { label: 'Superscript', icon: 'superscript', shortcut: `${M}.`, action: () => editor.chain().focus().toggleSuperscript().run() },
      { label: 'Subscript', icon: 'subscript', shortcut: `${M},`, action: () => editor.chain().focus().toggleSubscript().run() },
      { separator: true, label: '' },
      { label: 'Clear Formatting', icon: 'clearFormatting', action: () => editor.chain().focus().clearNodes().unsetAllMarks().run() },
      { separator: true, label: '' },
      { label: 'Increase Indent', icon: 'indent', action: () => editor.chain().focus().sinkListItem('listItem').run() },
      { label: 'Decrease Indent', icon: 'outdent', action: () => editor.chain().focus().liftListItem('listItem').run() },
    ]},
    { label: 'Tools', items: [
      { label: 'Suggest Mode', icon: 'suggest', action: () => setSuggesting(!isSuggesting()) },
      { separator: true, label: '' },
      { label: 'Workflows', icon: 'workflows', action: () => emit('opendesk:toggle-workflows') },
      { label: 'References', icon: 'references', action: () => emit('opendesk:toggle-reference-library') },
    ]},
  ];
}
