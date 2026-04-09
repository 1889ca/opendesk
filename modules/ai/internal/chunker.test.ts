/** Contract: contracts/ai/rules.md */
import { describe, it, expect } from 'vitest';
import { chunkText } from './chunker.ts';

describe('chunkText', () => {
  it('returns empty for blank input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   ')).toEqual([]);
  });

  it('returns one chunk for short text', () => {
    const chunks = chunkText('Hello world', 512);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].content).toBe('Hello world');
  });

  it('splits long text into multiple chunks', () => {
    const text = 'A'.repeat(1200);
    const chunks = chunkText(text, 512, 64);
    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should be <= chunkSize
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(512);
    }
  });

  it('preserves chunk indices', () => {
    const text = 'word '.repeat(300);
    const chunks = chunkText(text, 200, 30);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
    }
  });

  it('handles text with sentence boundaries', () => {
    const text = 'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.';
    const chunks = chunkText(text, 40, 10);
    expect(chunks.length).toBeGreaterThan(1);
    // All chunks should be non-empty
    for (const c of chunks) {
      expect(c.content.length).toBeGreaterThan(0);
    }
  });

  it('covers the full text content', () => {
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    const chunks = chunkText(words, 100, 20);
    const combined = chunks.map((c) => c.content).join(' ');
    // Every word should appear in at least one chunk
    for (let i = 0; i < 200; i++) {
      const present = chunks.some((c) => c.content.includes(`word${i}`));
      expect(present).toBe(true);
    }
  });
});
