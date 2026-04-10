/** Contract: contracts/references/rules.md */

import type { Reference, Author } from '../contract.ts';

/** A CSL-JSON name object. */
interface CslName {
  family?: string;
  given?: string;
  literal?: string;
}

/** A minimal CSL-JSON item (all fields we produce). */
interface CslItem {
  id: string;
  type: string;
  title: string;
  author?: CslName[];
  issued?: { 'date-parts': number[][] };
  'container-title'?: string;
  volume?: string;
  issue?: string;
  page?: string;
  DOI?: string;
  URL?: string;
  ISBN?: string;
  abstract?: string;
  publisher?: string;
  language?: string;
  keyword?: string;
}

/**
 * Internal ReferenceType values map directly to CSL type strings.
 * CSL does not have exact equivalents for every type so we use the
 * closest available label.
 */
const TYPE_TO_CSL: Record<string, string> = {
  'article-journal': 'article-journal',
  book: 'book',
  chapter: 'chapter',
  webpage: 'webpage',
  report: 'report',
  thesis: 'thesis',
  'paper-conference': 'paper-conference',
  patent: 'patent',
  legislation: 'legislation',
  dataset: 'dataset',
  software: 'software',
  'personal-communication': 'personal_communication',
  interview: 'interview',
  'motion-picture': 'motion_picture',
  broadcast: 'broadcast',
  other: 'article',
};

function mapAuthor(a: Author): CslName {
  if (a.literal) return { literal: a.literal };
  const out: CslName = {};
  if (a.family) out.family = a.family;
  if (a.given) out.given = a.given;
  return out;
}

/** Parse "YYYY", "YYYY-MM", or "YYYY-MM-DD" into a date-parts array. */
function parseDateParts(raw: string | null | undefined): number[][] | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/);
  if (!m) return null;
  const parts: number[] = [parseInt(m[1], 10)];
  if (m[2]) parts.push(parseInt(m[2], 10));
  if (m[3]) parts.push(parseInt(m[3], 10));
  return [parts];
}

/** Serialize a single Reference to a CSL-JSON item. */
function serializeItem(ref: Reference): CslItem {
  const item: CslItem = {
    id: ref.id,
    type: TYPE_TO_CSL[ref.type] ?? 'article',
    title: ref.title,
  };

  const authors = (ref.authors as Author[]) ?? [];
  if (authors.length > 0) {
    item.author = authors.map(mapAuthor);
  }

  const dateParts = parseDateParts(ref.issuedDate ?? null);
  if (dateParts) item.issued = { 'date-parts': dateParts };

  if (ref.containerTitle) item['container-title'] = ref.containerTitle;
  if (ref.volume) item.volume = ref.volume;
  if (ref.issue) item.issue = ref.issue;
  if (ref.pages) item.page = ref.pages;
  if (ref.doi) item.DOI = ref.doi;
  if (ref.url) item.URL = ref.url;
  if (ref.isbn) item.ISBN = ref.isbn;
  if (ref.abstract) item.abstract = ref.abstract;
  if (ref.publisher) item.publisher = ref.publisher;
  if (ref.language && ref.language !== 'en') item.language = ref.language;

  const tags = (ref.tags as string[]) ?? [];
  if (tags.length > 0) item.keyword = tags.join(', ');

  return item;
}

/** Serialize an array of References to a CSL-JSON string. */
export function serializeCSLJSON(refs: Reference[]): string {
  return JSON.stringify(refs.map(serializeItem), null, 2);
}
