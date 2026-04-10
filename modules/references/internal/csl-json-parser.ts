/** Contract: contracts/references/rules.md */

import type { ReferenceCreateInput, ReferenceType, Author } from '../contract.ts';

/**
 * CSL-JSON type mapping to internal ReferenceType.
 * CSL types: https://docs.citationstyles.org/en/stable/specification.html#appendix-iii-types
 */
const CSL_TYPE_MAP: Record<string, ReferenceType> = {
  'article-journal': 'article-journal',
  'article-magazine': 'article-journal',
  'article-newspaper': 'article-journal',
  article: 'article-journal',
  book: 'book',
  chapter: 'chapter',
  'entry-encyclopedia': 'chapter',
  'entry-dictionary': 'chapter',
  webpage: 'webpage',
  post: 'webpage',
  'post-weblog': 'webpage',
  report: 'report',
  thesis: 'thesis',
  'paper-conference': 'paper-conference',
  speech: 'paper-conference',
  patent: 'patent',
  legislation: 'legislation',
  legal_case: 'legislation',
  dataset: 'dataset',
  software: 'software',
  'personal_communication': 'personal-communication',
  interview: 'interview',
  motion_picture: 'motion-picture',
  broadcast: 'broadcast',
};

/** A CSL-JSON name object */
interface CslName {
  family?: string;
  given?: string;
  literal?: string;
  'non-dropping-particle'?: string;
  'dropping-particle'?: string;
}

/** Minimal CSL-JSON item shape — only fields we map. */
interface CslItem {
  id?: unknown;
  type?: string;
  title?: string;
  author?: CslName[];
  editor?: CslName[];
  issued?: { 'date-parts'?: number[][], raw?: string; literal?: string };
  'container-title'?: string;
  'collection-title'?: string;
  volume?: string | number;
  issue?: string | number;
  page?: string;
  DOI?: string;
  URL?: string;
  ISBN?: string;
  ISSN?: string;
  abstract?: string;
  publisher?: string;
  'publisher-place'?: string;
  language?: string;
  keyword?: string;
  categories?: string[];
  note?: string;
  [key: string]: unknown;
}

function mapName(n: CslName): Author {
  if (n.literal) return { literal: n.literal };
  const particle = n['non-dropping-particle'] ? `${n['non-dropping-particle']} ` : '';
  const family = particle + (n.family ?? '');
  return {
    family: family.trim() || undefined,
    given: n.given?.trim() || undefined,
  };
}

function extractIssuedDate(issued: CslItem['issued']): string | null {
  if (!issued) return null;
  if (issued['date-parts']?.[0]) {
    const parts = issued['date-parts'][0];
    if (parts.length >= 3) return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
    if (parts.length === 2) return `${parts[0]}-${String(parts[1]).padStart(2, '0')}`;
    if (parts.length === 1) return String(parts[0]);
  }
  if (issued.raw) return issued.raw;
  if (issued.literal) return issued.literal;
  return null;
}

function extractTags(item: CslItem): string[] {
  if (Array.isArray(item.categories)) return item.categories.map(String);
  if (typeof item.keyword === 'string') {
    return item.keyword.split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/** Parse a CSL-JSON array into ReferenceCreateInput[]. Skips items without a title. */
export function parseCSLJSON(input: string): ReferenceCreateInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return [];
  }

  const items: CslItem[] = Array.isArray(parsed) ? parsed : [parsed as CslItem];

  const results: ReferenceCreateInput[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (!title) continue;

    const cslType = typeof item.type === 'string' ? item.type : 'article-journal';
    const authors: Author[] = Array.isArray(item.author)
      ? item.author.map(mapName)
      : (Array.isArray(item.editor) ? item.editor.map(mapName) : []);

    const containerTitle = item['container-title'] ?? item['collection-title'] ?? null;

    const ref: ReferenceCreateInput = {
      type: CSL_TYPE_MAP[cslType] ?? 'other',
      title,
      authors,
      issuedDate: extractIssuedDate(item.issued ?? undefined),
      containerTitle: typeof containerTitle === 'string' ? containerTitle : null,
      volume: item.volume != null ? String(item.volume) : null,
      issue: item.issue != null ? String(item.issue) : null,
      pages: typeof item.page === 'string' ? item.page : null,
      doi: typeof item.DOI === 'string' ? item.DOI : null,
      url: typeof item.URL === 'string' ? item.URL : null,
      isbn: typeof item.ISBN === 'string' ? item.ISBN : null,
      abstract: typeof item.abstract === 'string' ? item.abstract : null,
      publisher: typeof item.publisher === 'string' ? item.publisher : null,
      language: typeof item.language === 'string' ? item.language : 'en',
      customFields: {},
      tags: extractTags(item),
    };

    results.push(ref);
  }

  return results;
}
