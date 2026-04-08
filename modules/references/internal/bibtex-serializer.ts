/** Contract: contracts/references/rules.md */

import type { Reference, ReferenceType, Author } from '../contract.ts';

const TYPE_TO_BIBTEX: Record<ReferenceType, string> = {
  'article-journal': 'article',
  book: 'book',
  chapter: 'incollection',
  webpage: 'online',
  report: 'techreport',
  thesis: 'phdthesis',
  'paper-conference': 'inproceedings',
  patent: 'misc',
  legislation: 'misc',
  dataset: 'misc',
  software: 'misc',
  'personal-communication': 'misc',
  interview: 'misc',
  'motion-picture': 'misc',
  broadcast: 'misc',
  other: 'misc',
};

/** Escape special BibTeX characters. */
function escapeValue(s: string): string {
  return s.replace(/([#$%&_{}])/g, '\\$1');
}

/** Format a single author as "Family, Given". */
function formatAuthor(a: Author): string {
  if (a.literal) return `{${a.literal}}`;
  const parts: string[] = [];
  if (a.family) parts.push(a.family);
  if (a.given) {
    if (parts.length > 0) parts.push(`, ${a.given}`);
    else parts.push(a.given);
  }
  return parts.join('') || 'Unknown';
}

/** Generate a citation key: first author last name + year, lowercased, no spaces. */
function makeCiteKey(ref: Reference): string {
  const firstAuthor = ref.authors?.[0];
  const name = (firstAuthor as Author)?.family
    ?? (firstAuthor as Author)?.literal
    ?? 'unknown';
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const year = ref.issuedDate?.match(/\d{4}/)?.[0] ?? '';
  return `${slug}${year}`;
}

/** Add a field line if the value is truthy. */
function field(name: string, value: string | null | undefined): string {
  if (!value) return '';
  return `  ${name} = {${escapeValue(value)}},\n`;
}

/** Serialize a single reference to a BibTeX entry string. */
function serializeEntry(ref: Reference): string {
  const entryType = TYPE_TO_BIBTEX[ref.type] ?? 'misc';
  const key = makeCiteKey(ref);
  const authors = (ref.authors as Author[]) ?? [];

  let out = `@${entryType}{${key},\n`;
  out += `  title = {${escapeValue(ref.title)}},\n`;

  if (authors.length > 0) {
    out += `  author = {${authors.map(formatAuthor).join(' and ')}},\n`;
  }
  out += field('year', ref.issuedDate?.match(/\d{4}/)?.[0]);

  // Map containerTitle to journal or booktitle depending on type
  if (ref.containerTitle) {
    const journalField = entryType === 'article' ? 'journal' : 'booktitle';
    out += field(journalField, ref.containerTitle);
  }

  out += field('volume', ref.volume);
  out += field('number', ref.issue);
  out += field('pages', ref.pages);
  out += field('doi', ref.doi);
  out += field('url', ref.url);
  out += field('isbn', ref.isbn);
  out += field('abstract', ref.abstract);
  out += field('publisher', ref.publisher);

  if (ref.language && ref.language !== 'en') {
    out += field('language', ref.language);
  }

  // Remove trailing comma+newline, close entry
  out = out.replace(/,\n$/, '\n');
  out += '}\n';
  return out;
}

/** Serialize an array of references to a BibTeX string. */
export function serializeBibTeX(refs: Reference[]): string {
  return refs.map(serializeEntry).join('\n');
}
