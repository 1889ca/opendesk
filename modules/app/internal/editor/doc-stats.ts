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
  const doc = editor.state.doc;
  // Use textBetween with a block separator so word counts are consistent
  // between the full document and any selection. Using doc.textContent (no
  // separator) causes words straddling paragraph boundaries to fuse into one
  // token for the total but split correctly for a selection — producing the
  // impossible "X of Y" display where X > Y.
  const docText = doc.textBetween(0, doc.content.size, ' ');
  const docParagraphs = countParagraphs(editor);
  const document = buildStats(docText, docParagraphs);

  const { from, to } = editor.state.selection;
  if (from === to) {
    return { document, selection: null };
  }

  const selText = doc.textBetween(from, to, ' ');
  let selParagraphs = 0;
  doc.nodesBetween(from, to, (node) => {
    if (node.isBlock && node.isTextblock) selParagraphs++;
    return true;
  });
  // Guard: selection word count must never exceed document word count.
  const selStats = buildStats(selText, Math.max(selParagraphs, 1));
  const selection: DocStats = {
    ...selStats,
    words: Math.min(selStats.words, document.words),
  };

  return { document, selection };
}
