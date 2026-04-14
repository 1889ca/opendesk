/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  category: string;
  keys: string[];
  icon?: string;
  shortcut?: string;
  action: (editor: Editor) => void;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'h1',
    label: 'Heading 1',
    description: 'Large section header',
    category: 'Text',
    keys: ['h1', 'heading1', 'heading'],
    icon: 'heading1',
    shortcut: '⌘⌥1',
    action: (e) => e.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    id: 'h2',
    label: 'Heading 2',
    description: 'Medium section header',
    category: 'Text',
    keys: ['h2', 'heading2'],
    icon: 'heading2',
    shortcut: '⌘⌥2',
    action: (e) => e.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    id: 'h3',
    label: 'Heading 3',
    description: 'Small section header',
    category: 'Text',
    keys: ['h3', 'heading3'],
    icon: 'heading3',
    shortcut: '⌘⌥3',
    action: (e) => e.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    id: 'quote',
    label: 'Blockquote',
    description: 'Quoted text',
    category: 'Text',
    keys: ['quote', 'blockquote'],
    icon: 'blockquote',
    action: (e) => e.chain().focus().setBlockquote().run(),
  },
  {
    id: 'code',
    label: 'Code block',
    description: 'Monospace code',
    category: 'Text',
    keys: ['code', 'codeblock'],
    icon: 'code',
    action: (e) => e.chain().focus().setCodeBlock().run(),
  },
  {
    id: 'bullet',
    label: 'Bullet list',
    description: 'Unordered list',
    category: 'List',
    keys: ['bullet', 'ul', 'list'],
    icon: 'bulletList',
    action: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'numbered',
    label: 'Numbered list',
    description: 'Ordered list',
    category: 'List',
    keys: ['numbered', 'ol', 'ordered'],
    icon: 'orderedList',
    action: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'table',
    label: 'Table',
    description: 'Insert a table',
    category: 'Insert',
    keys: ['table'],
    icon: 'table',
    action: (e) =>
      e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Upload or embed an image',
    category: 'Insert',
    keys: ['image', 'img', 'photo'],
    icon: 'image',
    action: () => document.dispatchEvent(new CustomEvent('opendesk:open-image-picker')),
  },
  {
    id: 'callout',
    label: 'Callout',
    description: 'Highlighted callout box',
    category: 'Insert',
    keys: ['callout', 'info', 'warning', 'note'],
    icon: 'callout',
    action: (e) => e.chain().focus().setBlockquote().run(),
  },
  {
    id: 'toggle',
    label: 'Toggle',
    description: 'Collapsible content block',
    category: 'Insert',
    keys: ['toggle', 'collapsible', 'accordion', 'details'],
    icon: 'toggle',
    action: (e) =>
      e.chain().focus().insertContent(
        '<details><summary>Toggle</summary><p>Content</p></details>',
      ).run(),
  },
  {
    id: 'footnote',
    label: 'Footnote',
    description: 'Add a footnote',
    category: 'Insert',
    keys: ['footnote', 'fn', 'endnote'],
    icon: 'footnote',
    action: () => document.dispatchEvent(new CustomEvent('opendesk:open-footnote')),
  },
  {
    id: 'emoji',
    label: 'Emoji',
    description: 'Insert an emoji',
    category: 'Insert',
    keys: ['emoji', 'smiley', 'emoticon'],
    icon: 'emoji',
    action: () => document.dispatchEvent(new CustomEvent('opendesk:open-emoji')),
  },
  {
    id: 'drawing',
    label: 'Drawing',
    description: 'Create a drawing',
    category: 'Insert',
    keys: ['drawing', 'draw', 'canvas', 'sketch'],
    icon: 'drawing',
    action: () => document.dispatchEvent(new CustomEvent('opendesk:open-drawing')),
  },
  {
    id: 'math',
    label: 'Math',
    description: 'Math equation (LaTeX)',
    category: 'Insert',
    keys: ['math', 'equation', 'formula', 'latex'],
    icon: 'math',
    action: (e) => e.chain().focus().insertContent('$$E = mc^2$$').run(),
  },
  {
    id: 'hr',
    label: 'Divider',
    description: 'Horizontal rule',
    category: 'Layout',
    keys: ['hr', 'divider', 'rule'],
    icon: 'horizontalRule',
    action: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    id: 'pagebreak',
    label: 'Page Break',
    description: 'Insert a page break',
    category: 'Layout',
    keys: ['pagebreak', 'break', 'page'],
    icon: 'pageBreak',
    action: () => document.dispatchEvent(new CustomEvent('opendesk:insert-page-break')),
  },
];

/** Filter commands by query against the keys array (case-insensitive includes). */
export function filterCommands(query: string): SlashCommand[] {
  if (!query) return SLASH_COMMANDS;
  const q = query.toLowerCase();
  return SLASH_COMMANDS.filter((cmd) =>
    cmd.keys.some((k) => k.includes(q)) || cmd.label.toLowerCase().includes(q),
  );
}
