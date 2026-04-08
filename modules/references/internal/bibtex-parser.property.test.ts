/** Contract: contracts/references/rules.md — Property-based tests */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseBibTeX } from './bibtex-parser.ts';

/** Generate a valid BibTeX entry string */
const bibtexEntryArb = fc
  .record({
    type: fc.constantFrom(
      'article',
      'book',
      'inproceedings',
      'phdthesis',
      'misc',
    ),
    key: fc.stringMatching(/^[a-zA-Z]{1,20}$/),
    title: fc.stringMatching(/^[a-zA-Z]{1,80}$/),
    author: fc.tuple(
      fc.stringMatching(/^[a-zA-Z]{1,20}$/),
      fc.stringMatching(/^[a-zA-Z]{1,20}$/),
    ),
    year: fc.integer({ min: 1900, max: 2030 }).map(String),
  })
  .map(
    ({ type, key, title, author, year }: { type: string; key: string; title: string; author: [string, string]; year: string }) =>
      `@${type}{${key},\n  title = {${title}},\n  author = {${author[0]}, ${author[1]}},\n  year = {${year}}\n}`,
  );

describe('references/bibtex-parser property tests', () => {
  it('parses valid BibTeX entries and preserves the title', () => {
    fc.assert(
      fc.property(bibtexEntryArb, (bibtex: string) => {
        const results = parseBibTeX(bibtex);
        expect(results.length).toBe(1);
        // Title should be present and non-empty
        expect(results[0].title.length).toBeGreaterThan(0);
      }),
    );
  });

  it('parses author names from valid entries', () => {
    fc.assert(
      fc.property(bibtexEntryArb, (bibtex: string) => {
        const results = parseBibTeX(bibtex);
        expect(results.length).toBe(1);
        expect(results[0].authors.length).toBeGreaterThan(0);
        for (const author of results[0].authors) {
          expect(
            author.family || author.given || author.literal,
          ).toBeTruthy();
        }
      }),
    );
  });

  it('handles arbitrary field names without crashing', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z]{1,15}$/),
        fc.stringMatching(/^[a-zA-Z]{1,30}$/),
        (fieldName: string, fieldValue: string) => {
          const bibtex = `@article{key1,\n  title = {Test Title},\n  ${fieldName} = {${fieldValue}}\n}`;
          const results = parseBibTeX(bibtex);
          expect(results.length).toBe(1);
          expect(results[0].title).toBe('Test Title');
        },
      ),
    );
  });

  it('does not crash on random input', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 2000 }), (input: string) => {
        // Should never throw, just return an array (possibly empty)
        const results = parseBibTeX(input);
        expect(Array.isArray(results)).toBe(true);
      }),
    );
  });

  it('multiple entries are all parsed independently', () => {
    fc.assert(
      fc.property(
        fc.array(bibtexEntryArb, { minLength: 1, maxLength: 5 }),
        (entries: string[]) => {
          const combined = entries.join('\n\n');
          const results = parseBibTeX(combined);
          expect(results.length).toBe(entries.length);
        },
      ),
    );
  });
});
