/** Contract: contracts/ai/rules.md */

export interface Chunk {
  index: number;
  content: string;
}

/**
 * Split text into overlapping chunks for embedding.
 * Uses a simple character-based splitter that respects sentence boundaries.
 */
export function chunkText(
  text: string,
  chunkSize = 512,
  overlap = 64,
): Chunk[] {
  if (!text.trim()) return [];

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    // Try to break at a sentence boundary
    if (end < text.length) {
      const slice = text.slice(start, end);
      const lastPeriod = slice.lastIndexOf('. ');
      const lastNewline = slice.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > chunkSize * 0.3) {
        end = start + breakPoint + 1;
      }
    }

    const content = text.slice(start, end).trim();
    if (content) {
      chunks.push({ index, content });
      index++;
    }

    start = end - overlap;
    if (start >= text.length) break;
    // Avoid infinite loops on very small remaining text
    if (end === text.length) break;
  }

  return chunks;
}
