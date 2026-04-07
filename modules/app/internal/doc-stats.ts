/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';

export interface DocStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  paragraphs: number;
  readingTime: string;
}

export interface StatsResult {
  document: DocStats;
  selection: DocStats | null;
}

const WORDS_PER_MINUTE = 200;

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function formatReadingTime(words: number): string {
  const minutes = Math.round(words / WORDS_PER_MINUTE);
  return minutes < 1 ? '' : String(minutes);
}

function countParagraphs(editor: Editor): number {
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.isBlock && node.isTextblock) {
      count++;
    }
    return true;
  });
  return Math.max(count, 1);
}

function buildStats(text: string, paragraphs: number): DocStats {
  const words = countWords(text);
  return {
    words,
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    paragraphs,
    readingTime: formatReadingTime(words),
  };
}

export function calculateStats(editor: Editor): StatsResult {
  const docText = editor.state.doc.textContent;
  const docParagraphs = countParagraphs(editor);
  const document = buildStats(docText, docParagraphs);

  const { from, to } = editor.state.selection;
  if (from === to) {
    return { document, selection: null };
  }

  const selText = editor.state.doc.textBetween(from, to, ' ');
  let selParagraphs = 0;
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.isBlock && node.isTextblock) selParagraphs++;
    return true;
  });
  const selection = buildStats(selText, Math.max(selParagraphs, 1));

  return { document, selection };
}
