/** Contract: contracts/references/rules.md */

import { describe, it, expect } from 'vitest';
import {
  transformCrossRefResponse,
  transformOpenLibraryResponse,
} from './doi-lookup.ts';

// Real CrossRef response shape (trimmed to relevant fields)
const CROSSREF_ARTICLE_FIXTURE = {
  title: ['Attention Is All You Need'],
  author: [
    { given: 'Ashish', family: 'Vaswani' },
    { given: 'Noam', family: 'Shazeer' },
    { given: 'Niki', family: 'Parmar' },
  ],
  'published-print': { 'date-parts': [[2017]] },
  'container-title': ['Advances in Neural Information Processing Systems'],
  volume: '30',
  issue: undefined,
  page: '5998-6008',
  DOI: '10.48550/arXiv.1706.03762',
  URL: 'https://doi.org/10.48550/arXiv.1706.03762',
  publisher: 'NeurIPS',
  type: 'journal-article',
};

const CROSSREF_BOOK_FIXTURE = {
  title: ['Design Patterns'],
  author: [
    { given: 'Erich', family: 'Gamma' },
    { given: 'Richard', family: 'Helm' },
  ],
  'published-print': { 'date-parts': [[1994, 10, 31]] },
  'container-title': [],
  DOI: '10.5555/186897',
  URL: 'https://doi.org/10.5555/186897',
  publisher: 'Addison-Wesley',
  type: 'book',
};

const CROSSREF_MINIMAL_FIXTURE = {
  // Minimal response — many fields missing
  title: ['Some Paper'],
  type: 'posted-content',
};

const OPENLIBRARY_FIXTURE = {
  title: 'The Pragmatic Programmer',
  authors: [
    { key: '/authors/OL1234A', name: 'Andrew Hunt' },
    { key: '/authors/OL5678A', name: 'David Thomas' },
  ],
  publish_date: 'October 20, 1999',
  publishers: ['Addison-Wesley'],
  isbn_13: ['9780201616224'],
  isbn_10: ['020161622X'],
  number_of_pages: 352,
};

const OPENLIBRARY_MINIMAL_FIXTURE = {
  title: 'Unknown Book',
};

describe('transformCrossRefResponse', () => {
  it('transforms a journal article with all fields', () => {
    const result = transformCrossRefResponse(CROSSREF_ARTICLE_FIXTURE);

    expect(result.title).toBe('Attention Is All You Need');
    expect(result.authors).toEqual(['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar']);
    expect(result.year).toBe(2017);
    expect(result.source).toBe('Advances in Neural Information Processing Systems');
    expect(result.volume).toBe('30');
    expect(result.pages).toBe('5998-6008');
    expect(result.doi).toBe('10.48550/arXiv.1706.03762');
    expect(result.url).toBe('https://doi.org/10.48550/arXiv.1706.03762');
    expect(result.publisher).toBe('NeurIPS');
    expect(result.type).toBe('article');
    expect(result.isbn).toBeNull();
  });

  it('transforms a book type', () => {
    const result = transformCrossRefResponse(CROSSREF_BOOK_FIXTURE);

    expect(result.title).toBe('Design Patterns');
    expect(result.authors).toHaveLength(2);
    expect(result.year).toBe(1994);
    expect(result.type).toBe('book');
    expect(result.publisher).toBe('Addison-Wesley');
  });

  it('handles minimal response with missing fields', () => {
    const result = transformCrossRefResponse(CROSSREF_MINIMAL_FIXTURE);

    expect(result.title).toBe('Some Paper');
    expect(result.authors).toEqual([]);
    expect(result.year).toBeNull();
    expect(result.source).toBeNull();
    expect(result.volume).toBeNull();
    expect(result.issue).toBeNull();
    expect(result.pages).toBeNull();
    expect(result.doi).toBeNull();
    expect(result.url).toBeNull();
    expect(result.publisher).toBeNull();
    expect(result.type).toBe('other');
  });

  it('handles empty title array', () => {
    const result = transformCrossRefResponse({ title: [], type: 'journal-article' });
    expect(result.title).toBe('Untitled');
    expect(result.type).toBe('article');
  });

  it('maps book-chapter type correctly', () => {
    const result = transformCrossRefResponse({ title: ['Ch. 1'], type: 'book-chapter' });
    expect(result.type).toBe('chapter');
  });

  it('falls back to published-online when print date is missing', () => {
    const result = transformCrossRefResponse({
      title: ['Online First'],
      'published-online': { 'date-parts': [[2023, 6, 15]] },
      type: 'journal-article',
    });
    expect(result.year).toBe(2023);
  });

  it('handles author with only family name', () => {
    const result = transformCrossRefResponse({
      title: ['Test'],
      author: [{ family: 'Smith' }],
      type: 'other',
    });
    expect(result.authors).toEqual(['Smith']);
  });
});

describe('transformOpenLibraryResponse', () => {
  it('transforms a full book response', () => {
    const result = transformOpenLibraryResponse(OPENLIBRARY_FIXTURE, '9780201616224');

    expect(result.title).toBe('The Pragmatic Programmer');
    expect(result.authors).toEqual(['Andrew Hunt', 'David Thomas']);
    expect(result.year).toBe(1999);
    expect(result.isbn).toBe('9780201616224');
    expect(result.publisher).toBe('Addison-Wesley');
    expect(result.type).toBe('book');
    expect(result.doi).toBeNull();
    expect(result.source).toBeNull();
  });

  it('handles minimal response', () => {
    const result = transformOpenLibraryResponse(OPENLIBRARY_MINIMAL_FIXTURE, '1234567890');

    expect(result.title).toBe('Unknown Book');
    expect(result.authors).toEqual([]);
    expect(result.year).toBeNull();
    expect(result.isbn).toBe('1234567890');
    expect(result.publisher).toBeNull();
    expect(result.type).toBe('book');
  });

  it('uses fallback ISBN from argument when book has none', () => {
    const result = transformOpenLibraryResponse({ title: 'Test' }, '9999999999');
    expect(result.isbn).toBe('9999999999');
  });

  it('prefers isbn_13 over isbn_10', () => {
    const result = transformOpenLibraryResponse(OPENLIBRARY_FIXTURE, '0000000000');
    expect(result.isbn).toBe('9780201616224');
  });

  it('extracts year from various date formats', () => {
    const result = transformOpenLibraryResponse(
      { title: 'Old Book', publish_date: '1985' },
      '111',
    );
    expect(result.year).toBe(1985);
  });
});
