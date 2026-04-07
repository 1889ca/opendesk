/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';

export interface HeadingEntry {
  id: string;
  level: number;
  text: string;
  pos: number;
}

/**
 * Walk the ProseMirror document and extract all heading nodes.
 * Returns an array of heading entries with level, text, and position.
 */
export function extractHeadings(editor: Editor): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  const doc = editor.state.doc;

  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const level = node.attrs.level as number;
      const text = node.textContent.trim();
      if (text) {
        headings.push({
          id: `toc-heading-${pos}`,
          level,
          text,
          pos,
        });
      }
    }
  });

  return headings;
}

/** Debounce a function by the given delay in milliseconds. */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };
}
