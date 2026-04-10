/** Contract: contracts/references/rules.md */

import { describe, it, expect } from 'vitest';
import { parseCSLJSON } from './csl-json-parser.ts';

const SAMPLE_CSL: object[] = [
  {
    id: 'doe2024',
    type: 'article-journal',
    title: 'A Great Paper',
    author: [{ family: 'Doe', given: 'John' }],
    issued: { 'date-parts': [[2024, 3, 15]] },
    'container-title': 'Nature',
    volume: '42',
    issue: '1',
    page: '10-20',
    DOI: '10.1234/nature.2024',
    abstract: 'Great abstract',
    publisher: 'Springer',
    keyword: 'biology, genetics',
  },
  {
    id: 'smith2020',
    type: 'book',
    title: 'Great Book',
    author: [{ family: 'Smith', given: 'Jane' }, { literal: 'International Team' }],
    issued: { 'date-parts': [[2020]] },
    ISBN: '978-3-16-148410-0',
    publisher: 'OUP',
  },
];

describe('parseCSLJSON', () => {
  it('parses a valid CSL-JSON array', () => {
    const result = parseCSLJSON(JSON.stringify(SAMPLE_CSL));
    expect(result).toHaveLength(2);
  });

  it('maps article-journal type correctly', () => {
    const [article] = parseCSLJSON(JSON.stringify(SAMPLE_CSL));
    expect(article.type).toBe('article-journal');
    expect(article.title).toBe('A Great Paper');
    expect(article.authors).toEqual([{ family: 'Doe', given: 'John' }]);
  });

  it('extracts full date-parts into issuedDate', () => {
    const [article] = parseCSLJSON(JSON.stringify(SAMPLE_CSL));
    expect(article.issuedDate).toBe('2024-03-15');
  });

  it('extracts year-only date-parts', () => {
    const [, book] = parseCSLJSON(JSON.stringify(SAMPLE_CSL));
    expect(book.issuedDate).toBe('2020');
  });

  it('maps CSL fields to internal fields', () => {
    const [article] = parseCSLJSON(JSON.stringify(SAMPLE_CSL));
    expect(article.containerTitle).toBe('Nature');
    expect(article.volume).toBe('42');
    expect(article.issue).toBe('1');
    expect(article.pages).toBe('10-20');
    expect(article.doi).toBe('10.1234/nature.2024');
    expect(article.abstract).toBe('Great abstract');
    expect(article.publisher).toBe('Springer');
  });

  it('parses keyword string into tags array', () => {
    const [article] = parseCSLJSON(JSON.stringify(SAMPLE_CSL));
    expect(article.tags).toEqual(['biology', 'genetics']);
  });

  it('handles literal authors', () => {
    const [, book] = parseCSLJSON(JSON.stringify(SAMPLE_CSL));
    expect(book.authors).toContainEqual({ literal: 'International Team' });
  });

  it('skips items without a title', () => {
    const input = JSON.stringify([{ id: 'x', type: 'book' }]);
    expect(parseCSLJSON(input)).toHaveLength(0);
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseCSLJSON('not json')).toHaveLength(0);
  });

  it('accepts a single CSL item (not in array)', () => {
    const single = { id: 'solo', type: 'book', title: 'Solo' };
    const result = parseCSLJSON(JSON.stringify(single));
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Solo');
  });
});
