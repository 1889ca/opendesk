/** Contract: contracts/app/suggestions.md */
import type { Editor } from '@tiptap/core';
import type { SuggestionEntry } from './types.ts';

/**
 * Collect all suggestion entries from the document.
 * Groups by suggestionId and returns positions + metadata.
 */
export function collectSuggestions(editor: Editor): SuggestionEntry[] {
  const { doc, schema } = editor.state;
  const insertType = schema.marks.suggestionInsert;
  const deleteType = schema.marks.suggestionDelete;
  const entries = new Map<string, SuggestionEntry>();

  doc.descendants((node, pos) => {
    for (const mark of node.marks) {
      if (mark.type !== insertType && mark.type !== deleteType) continue;

      const id = mark.attrs.suggestionId as string;
      const type = mark.type === insertType ? 'insert' : 'delete';
      const existing = entries.get(id);

      if (existing) {
        existing.from = Math.min(existing.from, pos);
        existing.to = Math.max(existing.to, pos + node.nodeSize);
        existing.text += node.textContent;
      } else {
        entries.set(id, {
          id,
          type,
          text: node.textContent,
          authorName: mark.attrs.authorName as string,
          authorColor: mark.attrs.authorColor as string,
          createdAt: mark.attrs.createdAt as string,
          from: pos,
          to: pos + node.nodeSize,
        });
      }
    }
  });

  return Array.from(entries.values()).sort((a, b) => a.from - b.from);
}

/**
 * Accept a suggestion:
 * - Insert: remove the mark, keep the text
 * - Delete: remove the marked text entirely
 */
export function acceptSuggestion(editor: Editor, id: string): void {
  const { state } = editor;
  const { doc, schema, tr } = state;
  const insertType = schema.marks.suggestionInsert;
  const deleteType = schema.marks.suggestionDelete;

  const ranges: Array<{ from: number; to: number; type: 'insert' | 'delete' }> = [];

  doc.descendants((node, pos) => {
    for (const mark of node.marks) {
      if (mark.attrs.suggestionId !== id) continue;
      if (mark.type === insertType) {
        ranges.push({ from: pos, to: pos + node.nodeSize, type: 'insert' });
      } else if (mark.type === deleteType) {
        ranges.push({ from: pos, to: pos + node.nodeSize, type: 'delete' });
      }
    }
  });

  ranges.sort((a, b) => b.from - a.from);

  for (const range of ranges) {
    if (range.type === 'insert') {
      tr.removeMark(range.from, range.to, insertType);
    } else {
      tr.delete(range.from, range.to);
    }
  }

  editor.view.dispatch(tr);
}

/**
 * Reject a suggestion:
 * - Insert: remove the inserted text
 * - Delete: remove the mark, keep the text
 */
export function rejectSuggestion(editor: Editor, id: string): void {
  const { state } = editor;
  const { doc, schema, tr } = state;
  const insertType = schema.marks.suggestionInsert;
  const deleteType = schema.marks.suggestionDelete;

  const ranges: Array<{ from: number; to: number; type: 'insert' | 'delete' }> = [];

  doc.descendants((node, pos) => {
    for (const mark of node.marks) {
      if (mark.attrs.suggestionId !== id) continue;
      if (mark.type === insertType) {
        ranges.push({ from: pos, to: pos + node.nodeSize, type: 'insert' });
      } else if (mark.type === deleteType) {
        ranges.push({ from: pos, to: pos + node.nodeSize, type: 'delete' });
      }
    }
  });

  ranges.sort((a, b) => b.from - a.from);

  for (const range of ranges) {
    if (range.type === 'insert') {
      tr.delete(range.from, range.to);
    } else {
      tr.removeMark(range.from, range.to, deleteType);
    }
  }

  editor.view.dispatch(tr);
}

/** Accept all pending suggestions. */
export function acceptAllSuggestions(editor: Editor): void {
  const suggestions = collectSuggestions(editor);
  for (const s of suggestions.reverse()) {
    acceptSuggestion(editor, s.id);
  }
}

/** Reject all pending suggestions. */
export function rejectAllSuggestions(editor: Editor): void {
  const suggestions = collectSuggestions(editor);
  for (const s of suggestions.reverse()) {
    rejectSuggestion(editor, s.id);
  }
}
