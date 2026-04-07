/** Contract: contracts/app/rules.md */
import type { ReferenceData, ReferenceAuthor, FormattedCitation } from './types.ts';
import {
  extractYear, surname, bibAuthorsApa, bibAuthorsMla,
  bibAuthorsVancouver, appendDoi,
} from './bib-formatters.ts';

export type CitationStyle = 'apa' | 'mla' | 'chicago' | 'vancouver';

/* ---------- Inline author lists per style ---------- */

function inlineAuthorsApa(authors: ReferenceAuthor[]): string {
  if (authors.length === 0) return 'Unknown';
  if (authors.length === 1) return surname(authors[0]);
  if (authors.length === 2) return `${surname(authors[0])} & ${surname(authors[1])}`;
  return `${surname(authors[0])} et al.`;
}

function inlineAuthorsMla(authors: ReferenceAuthor[]): string {
  if (authors.length === 0) return 'Unknown';
  return surname(authors[0]);
}

/* ---------- Inline citation formatting ---------- */

/**
 * Format a reference as an inline citation.
 * APA: (Smith, 2024)  MLA: (Smith 45)  Chicago: (Smith 2024, 45)  Vancouver: [1]
 */
export function formatInlineCitation(
  ref: ReferenceData,
  style: CitationStyle = 'apa',
  index?: number,
): string {
  const year = extractYear(ref.issuedDate);
  switch (style) {
    case 'mla': {
      const author = inlineAuthorsMla(ref.authors);
      return ref.pages ? `(${author} ${ref.pages})` : `(${author})`;
    }
    case 'chicago': {
      const author = inlineAuthorsApa(ref.authors);
      return ref.pages
        ? `(${author} ${year}, ${ref.pages})`
        : `(${author} ${year})`;
    }
    case 'vancouver':
      return `[${index ?? 1}]`;
    default: {
      const author = inlineAuthorsApa(ref.authors);
      return `(${author}, ${year})`;
    }
  }
}

/* ---------- Bibliography entry formatting ---------- */

function bibEntryApa(ref: ReferenceData): string {
  const authors = bibAuthorsApa(ref.authors);
  const year = extractYear(ref.issuedDate);
  const { title } = ref;

  if (ref.type === 'article-journal') {
    let e = `${authors} (${year}). ${title}.`;
    if (ref.containerTitle) {
      e += ` *${ref.containerTitle}*`;
      if (ref.volume) e += `, *${ref.volume}*`;
      if (ref.issue) e += `(${ref.issue})`;
      if (ref.pages) e += `, ${ref.pages}`;
      e += '.';
    }
    return appendDoi(e, ref);
  }
  if (ref.type === 'book') return appendDoi(`${authors} (${year}). *${title}*.`, ref);
  if (ref.type === 'chapter') {
    let e = `${authors} (${year}). ${title}.`;
    if (ref.containerTitle) {
      e += ` In *${ref.containerTitle}*`;
      if (ref.pages) e += ` (pp. ${ref.pages})`;
      e += '.';
    }
    return appendDoi(e, ref);
  }
  let e = `${authors} (${year}). ${title}.`;
  if (ref.containerTitle) e += ` ${ref.containerTitle}.`;
  return appendDoi(e, ref);
}

function bibEntryMla(ref: ReferenceData): string {
  const authors = bibAuthorsMla(ref.authors);
  const { title } = ref;

  let e = `${authors}. "${title}."`;
  if (ref.containerTitle) e += ` *${ref.containerTitle}*`;
  if (ref.volume) e += `, vol. ${ref.volume}`;
  if (ref.issue) e += `, no. ${ref.issue}`;
  const year = extractYear(ref.issuedDate);
  if (year !== 'n.d.') e += `, ${year}`;
  if (ref.pages) e += `, pp. ${ref.pages}`;
  e += '.';
  if (ref.doi) e += ` https://doi.org/${ref.doi}`;
  return e;
}

function bibEntryChicago(ref: ReferenceData): string {
  const authors = bibAuthorsApa(ref.authors);
  const year = extractYear(ref.issuedDate);
  const { title } = ref;

  if (ref.type === 'book') return appendDoi(`${authors}. ${year}. *${title}*.`, ref);
  let e = `${authors}. ${year}. "${title}."`;
  if (ref.containerTitle) {
    e += ` *${ref.containerTitle}*`;
    if (ref.volume) e += ` ${ref.volume}`;
    if (ref.issue) e += `, no. ${ref.issue}`;
    if (ref.pages) e += `: ${ref.pages}`;
  }
  e += '.';
  return appendDoi(e, ref);
}

function bibEntryVancouver(ref: ReferenceData): string {
  const authors = bibAuthorsVancouver(ref.authors);
  const { title } = ref;
  const year = extractYear(ref.issuedDate);

  let e = `${authors}. ${title}.`;
  if (ref.containerTitle) e += ` ${ref.containerTitle}.`;
  if (year !== 'n.d.') e += ` ${year}`;
  if (ref.volume) e += `;${ref.volume}`;
  if (ref.issue) e += `(${ref.issue})`;
  if (ref.pages) e += `:${ref.pages}`;
  e += '.';
  if (ref.doi) e += ` doi:${ref.doi}`;
  return e;
}

/** Format a full bibliography entry in the given style. */
export function formatBibliographyEntry(
  ref: ReferenceData,
  style: CitationStyle = 'apa',
): string {
  switch (style) {
    case 'mla': return bibEntryMla(ref);
    case 'chicago': return bibEntryChicago(ref);
    case 'vancouver': return bibEntryVancouver(ref);
    default: return bibEntryApa(ref);
  }
}

/** Format both inline and bibliography in one call. */
export function formatCitation(
  ref: ReferenceData,
  style: CitationStyle = 'apa',
  index?: number,
): FormattedCitation {
  return {
    inline: formatInlineCitation(ref, style, index),
    bibliography: formatBibliographyEntry(ref, style),
  };
}
