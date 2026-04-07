/** Contract: contracts/app/rules.md */
import type { ReferenceData, ReferenceAuthor, FormattedCitation } from './types.ts';

/** Extract the year from an ISO date string or year-only string. */
function extractYear(date?: string): string {
  if (!date) return 'n.d.';
  const match = date.match(/^(\d{4})/);
  return match ? match[1] : 'n.d.';
}

/** Format a single author name in APA style: "Family, G. I." */
function formatAuthorApa(author: ReferenceAuthor): string {
  if (author.literal) return author.literal;
  const family = author.family ?? '';
  if (!author.given) return family;
  const initials = author.given
    .split(/[\s-]+/)
    .map((part) => `${part[0]}.`)
    .join(' ');
  return `${family}, ${initials}`;
}

/** Format an author list for APA inline citation. */
function inlineAuthorsApa(authors: ReferenceAuthor[]): string {
  if (authors.length === 0) return 'Unknown';
  const surname = (a: ReferenceAuthor) => a.family ?? a.literal ?? 'Unknown';
  if (authors.length === 1) return surname(authors[0]);
  if (authors.length === 2) return `${surname(authors[0])} & ${surname(authors[1])}`;
  return `${surname(authors[0])} et al.`;
}

/** Format a full author list for APA bibliography entry. */
function bibAuthorsApa(authors: ReferenceAuthor[]): string {
  if (authors.length === 0) return 'Unknown';
  if (authors.length === 1) return formatAuthorApa(authors[0]);
  if (authors.length <= 7) {
    const all = authors.map(formatAuthorApa);
    const last = all.pop()!;
    return `${all.join(', ')}, & ${last}`;
  }
  const first = authors.slice(0, 6).map(formatAuthorApa);
  return `${first.join(', ')}, ... ${formatAuthorApa(authors[authors.length - 1])}`;
}

/**
 * Format a reference as an inline APA citation.
 * Returns e.g. "(Smith, 2024)" or "(Smith & Jones, 2024)".
 */
export function formatInlineCitation(
  ref: ReferenceData,
  _style?: string,
): string {
  const authors = inlineAuthorsApa(ref.authors);
  const year = extractYear(ref.issuedDate);
  return `(${authors}, ${year})`;
}

/**
 * Format a full APA bibliography entry.
 * Covers article-journal, book, chapter, and generic fallback.
 */
export function formatBibliographyEntry(
  ref: ReferenceData,
  _style?: string,
): string {
  const authors = bibAuthorsApa(ref.authors);
  const year = extractYear(ref.issuedDate);
  const title = ref.title;

  if (ref.type === 'article-journal') {
    return buildJournalEntry(authors, year, title, ref);
  }
  if (ref.type === 'book') {
    return buildBookEntry(authors, year, title, ref);
  }
  if (ref.type === 'chapter') {
    return buildChapterEntry(authors, year, title, ref);
  }
  return buildGenericEntry(authors, year, title, ref);
}

function buildJournalEntry(
  authors: string, year: string, title: string, ref: ReferenceData,
): string {
  let entry = `${authors} (${year}). ${title}.`;
  if (ref.containerTitle) {
    entry += ` *${ref.containerTitle}*`;
    if (ref.volume) entry += `, *${ref.volume}*`;
    if (ref.issue) entry += `(${ref.issue})`;
    if (ref.pages) entry += `, ${ref.pages}`;
    entry += '.';
  }
  return appendDoi(entry, ref);
}

function buildBookEntry(
  authors: string, year: string, title: string, ref: ReferenceData,
): string {
  let entry = `${authors} (${year}). *${title}*.`;
  return appendDoi(entry, ref);
}

function buildChapterEntry(
  authors: string, year: string, title: string, ref: ReferenceData,
): string {
  let entry = `${authors} (${year}). ${title}.`;
  if (ref.containerTitle) {
    entry += ` In *${ref.containerTitle}*`;
    if (ref.pages) entry += ` (pp. ${ref.pages})`;
    entry += '.';
  }
  return appendDoi(entry, ref);
}

function buildGenericEntry(
  authors: string, year: string, title: string, ref: ReferenceData,
): string {
  let entry = `${authors} (${year}). ${title}.`;
  if (ref.containerTitle) entry += ` ${ref.containerTitle}.`;
  return appendDoi(entry, ref);
}

function appendDoi(entry: string, ref: ReferenceData): string {
  if (ref.doi) return `${entry} https://doi.org/${ref.doi}`;
  if (ref.url) return `${entry} ${ref.url}`;
  return entry;
}

/**
 * Format both inline and bibliography in one call.
 */
export function formatCitation(
  ref: ReferenceData,
  style?: string,
): FormattedCitation {
  return {
    inline: formatInlineCitation(ref, style),
    bibliography: formatBibliographyEntry(ref, style),
  };
}
