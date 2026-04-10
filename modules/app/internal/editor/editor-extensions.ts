/** Contract: contracts/app/rules.md */
import type { AnyExtension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import Image from '@tiptap/extension-image';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type * as Y from 'yjs';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { SearchExtension } from './search/search-extension.ts';
import { CommentMark } from './comments/index.ts';
import { CitationMark } from './citations/index.ts';
import { PageBreak } from './page-break.ts';
import {
  SuggestionInsertMark,
  SuggestionDeleteMark,
} from './suggestions/index.ts';
import { createMentionExtension } from './mentions/index.ts';
import { EmojiInputRule } from './emoji/index.ts';
import { DragHandle } from './drag-handle/index.ts';
import { createEntityMentionExtension } from './entity-mentions/index.ts';
import { TextAlign } from './text-align.ts';
import { FontSize } from './font-size.ts';
import { FontFamily } from './font-family.ts';
import { LineHeight } from './line-height.ts';
import { YHistory } from './y-history.ts';
import { TextColor } from './text-color.ts';
import { TextHighlight } from './text-highlight.ts';
import { TabIndent } from './tab-indent.ts';
import { Superscript, Subscript } from './super-sub.ts';
import { SmartPunctuation } from './smart-punctuation.ts';
import { FootnoteNode } from './footnote.ts';
import { DrawingExtension } from './drawing/index.ts';
import { Placeholder } from './placeholder.ts';

const lowlight = createLowlight(common);

const CURSOR_COLORS = ['#7c3aed','#db2777','#d97706','#059669','#2563eb','#dc2626','#0891b2','#c2410c'];

/** Maps a username to a stable cursor color from the palette (issue #360). */
function getUserColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

interface ExtensionConfig {
  ydoc: Y.Doc;
  provider: HocuspocusProvider;
  user: { name: string; color: string };
}

/** Build the full array of TipTap extensions for the editor. */
export function buildEditorExtensions(config: ExtensionConfig): AnyExtension[] {
  const { ydoc, provider, user } = config;
  return [
    StarterKit.configure({ undoRedo: false, codeBlock: false, link: false, underline: false }),
    CodeBlockLowlight.configure({ lowlight }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Image.configure({
      inline: false,
      allowBase64: false,
      resize: { enabled: true, minWidth: 100, minHeight: 50 },
    }),
    SearchExtension,
    PageBreak,
    CommentMark,
    CitationMark,
    SuggestionInsertMark,
    SuggestionDeleteMark,
    EmojiInputRule,
    Collaboration.configure({ document: ydoc }),
    CollaborationCursor.configure({
      provider,
      user: { name: user.name, color: getUserColor(user.name) },
    }),
    createMentionExtension(provider),
    createEntityMentionExtension(),
    DragHandle,
    TextAlign,
    FontFamily,
    FontSize,
    LineHeight,
    TextColor,
    TextHighlight,
    TabIndent,
    Superscript,
    Subscript,
    YHistory,
    SmartPunctuation,
    FootnoteNode,
    DrawingExtension,
    Placeholder,
    Underline,
    Link.configure({ openOnClick: false, autolink: true }),
  ];
}
