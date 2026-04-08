/** Contract: contracts/ai/rules.md */
import { describe, it, expect } from 'vitest';
import { chunkText } from './embedder.ts';

describe('chunkText', () => {
  it('returns empty array for empty text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('', 100, 10)).toEqual([]);
  });

  it('returns single chunk for text shorter than chunk size', () => {
    const result = chunkText('Hello world', 100, 10);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Hello world');
  });

  it('splits long text into overlapping chunks', () => {
    const text = 'A'.repeat(200);
    const result = chunkText(text, 100, 20);

    // First chunk: 0..100, second chunk: 80..180, third chunk: 160..200
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toHaveLength(100);
  });

  it('respects overlap parameter', () => {
    // 50 chars, chunk=20, overlap=5 -> chunks at 0-20, 15-35, 30-50
    const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmno';
    const result = chunkText(text, 20, 5);

    expect(result.length).toBeGreaterThan(1);
    // The second chunk should start 15 chars into the text
    const secondStart = text.slice(15, 35);
    expect(result[1]).toBe(secondStart);
  });

  it('handles zero overlap', () => {
    const text = 'A'.repeat(50);
    const result = chunkText(text, 20, 0);
    expect(result).toHaveLength(3); // 0-20, 20-40, 40-50
  });

  it('trims whitespace from chunks', () => {
    const text = '  Hello   World  ';
    const result = chunkText(text, 100);
    expect(result[0]).toBe('Hello   World');
  });
});
