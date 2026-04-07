/** Contract: contracts/references/rules.md */

import type { Reference, ReferenceType, Author } from '../contract.ts';

const TYPE_TO_RIS: Record<ReferenceType, string> = {
  'article-journal': 'JOUR',
  book: 'BOOK',
  chapter: 'CHAP',
  webpage: 'ELEC',
  report: 'RPRT',
  thesis: 'THES',
  'paper-conference': 'CONF',
  patent: 'PAT',
  legislation: 'STAT',
  dataset: 'DATA',
  software: 'COMP',
  'personal-communication': 'PCOMM',
  interview: 'GEN',
  'motion-picture': 'MPCT',
  broadcast: 'GEN',
  other: 'GEN',
};

/** Format an author as "Family, Given" for RIS AU tag. */
function formatAuthor(a: Author): string {
  if (a.literal) return a.literal;
  const parts: string[] = [];
  if (a.family) parts.push(a.family);
  if (a.given) parts.push(a.given);
  return parts.join(', ') || 'Unknown';
}

/** Emit a single RIS tag line. */
function tag(code: string, value: string | null | undefined): string {
  if (!value) return '';
  return `${code}  - ${value}\n`;
}

/** Serialize a single reference to RIS format. */
function serializeEntry(ref: Reference): string {
  const risType = TYPE_TO_RIS[ref.type] ?? 'GEN';
  const authors = (ref.authors as Author[]) ?? [];

  let out = tag('TY', risType)!;
  out += tag('TI', ref.title);

  for (const a of authors) {
    out += tag('AU', formatAuthor(a));
  }

  out += tag('PY', ref.issuedDate?.match(/\d{4}/)?.[0]);
  out += tag('JO', ref.containerTitle);
  out += tag('VL', ref.volume);
  out += tag('IS', ref.issue);

  // Split pages into SP/EP
  if (ref.pages) {
    const pageParts = ref.pages.split(/[-–]/);
    out += tag('SP', pageParts[0]?.trim());
    if (pageParts.length > 1) {
      out += tag('EP', pageParts[1]?.trim());
    }
  }

  out += tag('DO', ref.doi);
  out += tag('UR', ref.url);
  out += tag('SN', ref.isbn);
  out += tag('AB', ref.abstract);
  out += tag('PB', ref.publisher);

  if (ref.language && ref.language !== 'en') {
    out += tag('LA', ref.language);
  }

  for (const kw of ref.tags ?? []) {
    out += tag('KW', kw);
  }

  out += 'ER  - \n';
  return out;
}

/** Serialize an array of references to RIS format. */
export function serializeRIS(refs: Reference[]): string {
  return refs.map(serializeEntry).join('\n');
}
