/** Contract: contracts/references/rules.md */

import type { ReferenceCreateInput, ReferenceType, Author } from '../contract.ts';

const LATEX_ACCENTS: Record<string, Record<string, string>> = {
  '"': { o: 'ö', u: 'ü', a: 'ä', e: 'ë', i: 'ï', O: 'Ö', U: 'Ü', A: 'Ä', E: 'Ë', I: 'Ï' },
  "'": { e: 'é', a: 'á', i: 'í', o: 'ó', u: 'ú', E: 'É', A: 'Á', I: 'Í', O: 'Ó', U: 'Ú' },
  '`': { e: 'è', a: 'à', i: 'ì', o: 'ò', u: 'ù', E: 'È', A: 'À', I: 'Ì', O: 'Ò', U: 'Ù' },
  '^': { e: 'ê', a: 'â', i: 'î', o: 'ô', u: 'û', E: 'Ê', A: 'Â', I: 'Î', O: 'Ô', U: 'Û' },
  '~': { n: 'ñ', a: 'ã', o: 'õ', N: 'Ñ', A: 'Ã', O: 'Õ' },
  'c': { c: 'ç', C: 'Ç' },
};

const BIBTEX_TYPE_MAP: Record<string, ReferenceType> = {
  article: 'article-journal',
  book: 'book',
  inbook: 'chapter',
  incollection: 'chapter',
  inproceedings: 'paper-conference',
  conference: 'paper-conference',
  phdthesis: 'thesis',
  mastersthesis: 'thesis',
  techreport: 'report',
  misc: 'other',
  online: 'webpage',
  unpublished: 'other',
};

/** Remove curly braces used for case preservation and decode LaTeX accents. */
function cleanValue(raw: string): string {
  let s = raw.trim();
  // Decode LaTeX accents: \"{o} or \"o or \'{e} etc.
  s = s.replace(/\\(["`'^~c])\{([a-zA-Z])}/g, (_m, accent: string, char: string) => {
    return LATEX_ACCENTS[accent]?.[char] ?? char;
  });
  s = s.replace(/\\(["`'^~])([a-zA-Z])/g, (_m, accent: string, char: string) => {
    return LATEX_ACCENTS[accent]?.[char] ?? char;
  });
  // Strip remaining braces
  s = s.replace(/[{}]/g, '');
  return s.trim();
}

/** Parse BibTeX author field: "Last, First and Last, First" or "First Last and First Last". */
function parseAuthors(raw: string): Author[] {
  const parts = raw.split(/\s+and\s+/i);
  return parts.map((part) => {
    const cleaned = cleanValue(part);
    if (!cleaned) return { literal: 'Unknown' };
    if (cleaned.includes(',')) {
      const [family, given] = cleaned.split(',', 2);
      return { family: family.trim(), given: given?.trim() || undefined };
    }
    const words = cleaned.split(/\s+/);
    if (words.length === 1) return { family: words[0] };
    return { family: words[words.length - 1], given: words.slice(0, -1).join(' ') };
  }).filter((a) => a.family || a.given || a.literal);
}

/** Extract balanced-brace field value starting after the opening delimiter. */
function extractFieldValue(content: string, start: number): { value: string; end: number } | null {
  const opener = content[start];
  if (opener === '"') {
    // Find closing quote (not preceded by backslash), respecting nested braces
    let i = start + 1;
    let depth = 0;
    while (i < content.length) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}') depth--;
      else if (content[i] === '"' && depth === 0) {
        return { value: content.slice(start + 1, i), end: i + 1 };
      }
      i++;
    }
    return null;
  }
  if (opener === '{') {
    let i = start + 1;
    let depth = 1;
    while (i < content.length && depth > 0) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}') depth--;
      i++;
    }
    return depth === 0 ? { value: content.slice(start + 1, i - 1), end: i } : null;
  }
  // Bare value (number etc.)
  const match = content.slice(start).match(/^([^\s,}]+)/);
  return match ? { value: match[1], end: start + match[1].length } : null;
}

/** Parse fields from the body of a BibTeX entry. */
function parseFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const fieldRe = /(\w+)\s*=\s*/g;
  let m: RegExpExecArray | null;
  while ((m = fieldRe.exec(body)) !== null) {
    const result = extractFieldValue(body, m.index + m[0].length);
    if (result) {
      fields[m[1].toLowerCase()] = result.value;
      fieldRe.lastIndex = result.end;
    }
  }
  return fields;
}

/** Parse a BibTeX string into ReferenceCreateInput[]. Skips malformed entries. */
export function parseBibTeX(input: string): ReferenceCreateInput[] {
  const results: ReferenceCreateInput[] = [];
  // Match @type{key, ... } allowing nested braces
  const entryRe = /@(\w+)\s*\{/g;
  let em: RegExpExecArray | null;

  while ((em = entryRe.exec(input)) !== null) {
    const entryType = em[1].toLowerCase();
    if (entryType === 'comment' || entryType === 'preamble' || entryType === 'string') continue;

    // Find balanced closing brace
    let depth = 1;
    let i = em.index + em[0].length;
    while (i < input.length && depth > 0) {
      if (input[i] === '{') depth++;
      else if (input[i] === '}') depth--;
      i++;
    }
    if (depth !== 0) continue;

    const body = input.slice(em.index + em[0].length, i - 1);
    // Skip citation key (everything before first comma)
    const commaIdx = body.indexOf(',');
    if (commaIdx === -1) continue;
    const fieldBody = body.slice(commaIdx + 1);

    try {
      const fields = parseFields(fieldBody);
      const title = cleanValue(fields.title ?? '');
      if (!title) continue;

      const ref: ReferenceCreateInput = {
        type: BIBTEX_TYPE_MAP[entryType] ?? 'other',
        title,
        authors: fields.author ? parseAuthors(fields.author) : [],
        issuedDate: fields.year ? cleanValue(fields.year) : null,
        containerTitle: fields.journal ? cleanValue(fields.journal) : (fields.booktitle ? cleanValue(fields.booktitle) : null),
        volume: fields.volume ? cleanValue(fields.volume) : null,
        issue: fields.number ? cleanValue(fields.number) : null,
        pages: fields.pages ? cleanValue(fields.pages).replace('--', '-') : null,
        doi: fields.doi ? cleanValue(fields.doi) : null,
        url: fields.url ? cleanValue(fields.url) : null,
        isbn: fields.isbn ? cleanValue(fields.isbn) : null,
        abstract: fields.abstract ? cleanValue(fields.abstract) : null,
        publisher: fields.publisher ? cleanValue(fields.publisher) : null,
        language: fields.language ? cleanValue(fields.language) : 'en',
        customFields: {},
        tags: fields.keywords ? cleanValue(fields.keywords).split(/[,;]\s*/) : [],
      };
      results.push(ref);
    } catch {
      // Skip malformed entries
    }
    entryRe.lastIndex = i;
  }
  return results;
}
