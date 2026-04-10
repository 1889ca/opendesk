/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  category: string;
  keys: string[];
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
    shortcut: '⌘⌥1',
    action: (e) => e.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    id: 'h2',
    label: 'Heading 2',
    description: 'Medium section header',
    category: 'Text',
    keys: ['h2', 'heading2'],
    shortcut: '⌘⌥2',
    action: (e) => e.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    id: 'h3',
    label: 'Heading 3',
    description: 'Small section header',
    category: 'Text',
    keys: ['h3', 'heading3'],
    shortcut: '⌘⌥3',
    action: (e) => e.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    id: 'bullet',
    label: 'Bullet list',
    description: 'Unordered list',
    category: 'List',
    keys: ['bullet', 'ul', 'list'],
    action: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'numbered',
    label: 'Numbered list',
    description: 'Ordered list',
    category: 'List',
    keys: ['numbered', 'ol', 'ordered'],
    action: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'quote',
    label: 'Blockquote',
    description: 'Quoted text',
    category: 'Text',
    keys: ['quote', 'blockquote'],
    action: (e) => e.chain().focus().setBlockquote().run(),
  },
  {
    id: 'code',
    label: 'Code block',
    description: 'Monospace code',
    category: 'Text',
    keys: ['code', 'codeblock'],
    action: (e) => e.chain().focus().setCodeBlock().run(),
  },
  {
    id: 'table',
    label: 'Table',
    description: 'Insert a table',
    category: 'Insert',
    keys: ['table'],
    action: (e) =>
      e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: 'hr',
    label: 'Divider',
    description: 'Horizontal rule',
    category: 'Insert',
    keys: ['hr', 'divider', 'rule'],
    action: (e) => e.chain().focus().setHorizontalRule().run(),
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
