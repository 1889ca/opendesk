/** Contract: contracts/ai/rules.md — Property-based tests */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { chunkText } from './chunker.ts';

describe('ai/chunker property tests', () => {
  it('chunks never exceed max size', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 5000 }),
        fc.integer({ min: 50, max: 1024 }),
        fc.integer({ min: 0, max: 100 }),
        (text, chunkSize, overlap) => {
          const safeOverlap = Math.min(overlap, chunkSize - 1);
          const chunks = chunkText(text, chunkSize, safeOverlap);
          for (const chunk of chunks) {
            expect(chunk.content.length).toBeLessThanOrEqual(chunkSize);
          }
        },
      ),
    );
  });

  it('all input text is represented in output chunks', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 3000 }),
        (text) => {
          if (!text.trim()) return;
          const chunks = chunkText(text, 512, 64);
          // Every non-whitespace character from input should appear in some chunk
          const allChunkText = chunks.map((c) => c.content).join(' ');
          const words = text.trim().split(/\s+/).filter(Boolean);
          for (const word of words) {
            expect(allChunkText).toContain(word);
          }
        },
      ),
    );
  });

  it('chunks maintain sequential index order', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 3000 }),
        (text) => {
          const chunks = chunkText(text);
          for (let i = 0; i < chunks.length; i++) {
            expect(chunks[i].index).toBe(i);
          }
        },
      ),
    );
  });

  it('empty or whitespace-only input produces empty output', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[ \t\n\r]*$/),
        (whitespace) => {
          const chunks = chunkText(whitespace);
          expect(chunks).toEqual([]);
        },
      ),
    );
  });

  it('single-character non-whitespace input produces exactly one chunk', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z]$/),
        (ch) => {
          const chunks = chunkText(ch);
          expect(chunks.length).toBe(1);
          expect(chunks[0].content).toBe(ch);
          expect(chunks[0].index).toBe(0);
        },
      ),
    );
  });
});
