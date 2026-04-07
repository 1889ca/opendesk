/** Contract: contracts/references/rules.md -- Verification tests */
import { describe, it, expect } from 'vitest';
import { parseRIS } from './ris-parser.ts';

describe('parseRIS', () => {
  it('parses a standard journal article', () => {
    const input = `TY  - JOUR
AU  - Smith, John
AU  - Doe, Jane
TI  - A Study of Testing
JO  - Journal of Software
PY  - 2024
VL  - 12
IS  - 3
SP  - 100
EP  - 110
DO  - 10.1234/test.2024
AB  - This is the abstract.
ER  - `;
    const refs = parseRIS(input);
    expect(refs).toHaveLength(1);
    const r = refs[0];
    expect(r.type).toBe('article-journal');
    expect(r.title).toBe('A Study of Testing');
    expect(r.authors).toEqual([
      { family: 'Smith', given: 'John' },
      { family: 'Doe', given: 'Jane' },
    ]);
    expect(r.issuedDate).toBe('2024');
    expect(r.volume).toBe('12');
    expect(r.issue).toBe('3');
    expect(r.pages).toBe('100-110');
    expect(r.doi).toBe('10.1234/test.2024');
    expect(r.abstract).toBe('This is the abstract.');
    expect(r.containerTitle).toBe('Journal of Software');
  });

  it('parses a book entry', () => {
    const input = `TY  - BOOK
AU  - Knuth, Donald E.
TI  - The Art of Computer Programming
PB  - Addison-Wesley
PY  - 1997
SN  - 978-0-201-89683-1
ER  - `;
    const refs = parseRIS(input);
    expect(refs).toHaveLength(1);
    expect(refs[0].type).toBe('book');
    expect(refs[0].publisher).toBe('Addison-Wesley');
    expect(refs[0].isbn).toBe('978-0-201-89683-1');
  });

  it('parses multiple records', () => {
    const input = `TY  - JOUR
TI  - First Article
PY  - 2020
ER  -

TY  - BOOK
TI  - Second Book
PY  - 2021
ER  - `;
    const refs = parseRIS(input);
    expect(refs).toHaveLength(2);
    expect(refs[0].title).toBe('First Article');
    expect(refs[1].title).toBe('Second Book');
  });

  it('handles keywords as tags', () => {
    const input = `TY  - JOUR
TI  - Tagged Entry
KW  - machine learning
KW  - NLP
KW  - transformers
PY  - 2024
ER  - `;
    const refs = parseRIS(input);
    expect(refs[0].tags).toEqual(['machine learning', 'NLP', 'transformers']);
  });

  it('handles conference proceedings', () => {
    const input = `TY  - CONF
AU  - Lee, Alice
TI  - Distributed Systems Talk
T2  - Proc. ACM Conference
PY  - 2023
ER  - `;
    const refs = parseRIS(input);
    expect(refs[0].type).toBe('paper-conference');
    expect(refs[0].containerTitle).toBe('Proc. ACM Conference');
  });

  it('handles thesis type', () => {
    const input = `TY  - THES
AU  - Researcher, Pat
TI  - My Dissertation
PB  - MIT
PY  - 2019
ER  - `;
    const refs = parseRIS(input);
    expect(refs[0].type).toBe('thesis');
  });

  it('handles start page only (no end page)', () => {
    const input = `TY  - JOUR
TI  - Single Page
SP  - 42
PY  - 2022
ER  - `;
    const refs = parseRIS(input);
    expect(refs[0].pages).toBe('42');
  });

  it('skips records without a title', () => {
    const input = `TY  - JOUR
AU  - Nobody, A.
PY  - 2020
ER  - `;
    const refs = parseRIS(input);
    expect(refs).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(parseRIS('')).toEqual([]);
  });

  it('handles unterminated record gracefully', () => {
    const input = `TY  - JOUR
TI  - No End Record
PY  - 2024`;
    const refs = parseRIS(input);
    expect(refs).toHaveLength(1);
    expect(refs[0].title).toBe('No End Record');
  });

  it('uses A1 tag as fallback for authors', () => {
    const input = `TY  - JOUR
A1  - Fallback, Author
TI  - Fallback Authors
PY  - 2023
ER  - `;
    const refs = parseRIS(input);
    expect(refs[0].authors[0].family).toBe('Fallback');
  });

  it('uses T1 tag as fallback for title', () => {
    const input = `TY  - JOUR
T1  - Alternative Title Tag
PY  - 2023
ER  - `;
    const refs = parseRIS(input);
    expect(refs[0].title).toBe('Alternative Title Tag');
  });

  it('handles URL and language fields', () => {
    const input = `TY  - ELEC
TI  - A Webpage
UR  - https://example.com/page
LA  - fr
PY  - 2024
ER  - `;
    const refs = parseRIS(input);
    expect(refs[0].type).toBe('webpage');
    expect(refs[0].url).toBe('https://example.com/page');
    expect(refs[0].language).toBe('fr');
  });
});
