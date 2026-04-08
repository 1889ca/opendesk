/** Contract: contracts/references/rules.md */

import type { ReferenceCreateInput, ReferenceType, Author } from '../contract.ts';

const RIS_TYPE_MAP: Record<string, ReferenceType> = {
  JOUR: 'article-journal',
  JFULL: 'article-journal',
  ABST: 'article-journal',
  BOOK: 'book',
  CHAP: 'chapter',
  CONF: 'paper-conference',
  CPAPER: 'paper-conference',
  THES: 'thesis',
  RPRT: 'report',
  ELEC: 'webpage',
  ICOMM: 'webpage',
  WEB: 'webpage',
  PAT: 'patent',
  STAT: 'legislation',
  DATA: 'dataset',
  COMP: 'software',
  PCOMM: 'personal-communication',
  MPCT: 'motion-picture',
  VIDEO: 'motion-picture',
  GEN: 'other',
  UNPB: 'other',
};

/** Parse a single author string "Last, First" or "First Last". */
function parseAuthor(raw: string): Author {
  const s = raw.trim();
  if (!s) return { literal: 'Unknown' };
  if (s.includes(',')) {
    const [family, given] = s.split(',', 2);
    return { family: family.trim(), given: given?.trim() || undefined };
  }
  const words = s.split(/\s+/);
  if (words.length === 1) return { family: words[0] };
  return { family: words[words.length - 1], given: words.slice(0, -1).join(' ') };
}

/** Parse a RIS-format string into ReferenceCreateInput[]. */
export function parseRIS(input: string): ReferenceCreateInput[] {
  const results: ReferenceCreateInput[] = [];
  const lines = input.split(/\r?\n/);

  let current: Record<string, string[]> | null = null;

  for (const line of lines) {
    const tagMatch = line.match(/^([A-Z][A-Z0-9])\s{2}-\s?(.*)/);
    if (!tagMatch) continue;

    const [, tag, value] = tagMatch;
    const val = value.trim();

    if (tag === 'TY') {
      current = {};
      pushTag(current, 'TY', val);
      continue;
    }

    if (tag === 'ER') {
      if (current) {
        const ref = buildReference(current);
        if (ref) results.push(ref);
      }
      current = null;
      continue;
    }

    if (current) {
      pushTag(current, tag, val);
    }
  }

  // Handle unterminated record
  if (current) {
    const ref = buildReference(current);
    if (ref) results.push(ref);
  }

  return results;
}

function pushTag(record: Record<string, string[]>, tag: string, value: string): void {
  if (!record[tag]) record[tag] = [];
  record[tag].push(value);
}

function first(record: Record<string, string[]>, tag: string): string | null {
  return record[tag]?.[0]?.trim() || null;
}

function buildReference(record: Record<string, string[]>): ReferenceCreateInput | null {
  const title = first(record, 'TI') ?? first(record, 'T1') ?? first(record, 'CT');
  if (!title) return null;

  const typeCode = first(record, 'TY') ?? 'GEN';
  const authors: Author[] = (record['AU'] ?? record['A1'] ?? []).map(parseAuthor);

  // Year: PY tag, take first 4 digits
  const pyRaw = first(record, 'PY') ?? first(record, 'Y1') ?? first(record, 'DA');
  const yearMatch = pyRaw?.match(/(\d{4})/);
  const issuedDate = yearMatch ? yearMatch[1] : null;

  // Pages: SP (start page) and EP (end page)
  const sp = first(record, 'SP');
  const ep = first(record, 'EP');
  const pages = sp && ep ? `${sp}-${ep}` : (sp ?? null);

  return {
    type: RIS_TYPE_MAP[typeCode] ?? 'other',
    title,
    authors,
    issuedDate,
    containerTitle: first(record, 'JO') ?? first(record, 'JF') ?? first(record, 'T2') ?? first(record, 'BT'),
    volume: first(record, 'VL'),
    issue: first(record, 'IS'),
    pages,
    doi: first(record, 'DO') ?? first(record, 'M3'),
    url: first(record, 'UR'),
    isbn: first(record, 'SN'),
    abstract: first(record, 'AB') ?? first(record, 'N2'),
    publisher: first(record, 'PB'),
    language: first(record, 'LA') ?? 'en',
    customFields: {},
    tags: record['KW'] ?? [],
  };
}
