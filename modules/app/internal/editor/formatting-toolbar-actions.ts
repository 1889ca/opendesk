/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { t, type TranslationKey } from '../i18n/index.ts';

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
    // ── Core text formatting ─────────────────────────────────────────
    { key: 'toolbar.bold', icon: 'bold', ariaKey: 'a11y.boldLabel', titleKey: 'shortcuts.bold', action: () => editor.chain().focus().toggleBold().run(), isActive: () => editor.isActive('bold'), announceOnKey: 'a11y.boldOn', announceOffKey: 'a11y.boldOff' },
    { key: 'toolbar.italic', icon: 'italic', ariaKey: 'a11y.italicLabel', titleKey: 'shortcuts.italic', action: () => editor.chain().focus().toggleItalic().run(), isActive: () => editor.isActive('italic'), announceOnKey: 'a11y.italicOn', announceOffKey: 'a11y.italicOff' },
    { key: 'toolbar.underline', icon: 'underline', ariaKey: 'a11y.underlineLabel', titleKey: 'shortcuts.underline', action: () => editor.chain().focus().toggleUnderline().run(), isActive: () => editor.isActive('underline'), announceOnKey: 'a11y.underlineOn', announceOffKey: 'a11y.underlineOff' },
    { key: 'toolbar.strike', icon: 'strikethrough', ariaKey: 'a11y.strikeLabel', titleKey: 'shortcuts.strikethrough', action: () => editor.chain().focus().toggleStrike().run(), isActive: () => editor.isActive('strike'), announceOnKey: 'a11y.strikeOn', announceOffKey: 'a11y.strikeOff' },
    { key: null, action: () => false },
    // ── Lists ─────────────────────────────────────────────────────────
    { key: 'toolbar.bulletList', icon: 'bulletList', ariaKey: 'a11y.bulletListLabel', titleKey: 'shortcuts.bulletList', action: () => editor.chain().focus().toggleBulletList().run(), isActive: () => editor.isActive('bulletList') },
    { key: 'toolbar.orderedList', icon: 'orderedList', ariaKey: 'a11y.orderedListLabel', titleKey: 'shortcuts.orderedList', action: () => editor.chain().focus().toggleOrderedList().run(), isActive: () => editor.isActive('orderedList') },
    { key: null, action: () => false },
    // ── Link ──────────────────────────────────────────────────────────
    { key: 'toolbar.link', icon: 'link', ariaKey: 'a11y.linkLabel', titleKey: 'shortcuts.link', action: (btn?: HTMLButtonElement) => { document.dispatchEvent(new CustomEvent('opendesk:open-link-popover', { detail: { anchor: btn } })); return true; }, passSelf: true, isActive: () => editor.isActive('link') },
    { key: null, action: () => false },
    // ── Indent ─────────────────────────────────────────────────────────
    { key: 'toolbar.indent', icon: 'indent', ariaKey: 'a11y.indentLabel', action: () => editor.chain().focus().sinkListItem('listItem').run() },
    { key: 'toolbar.outdent', icon: 'outdent', ariaKey: 'a11y.outdentLabel', action: () => editor.chain().focus().liftListItem('listItem').run() },
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
