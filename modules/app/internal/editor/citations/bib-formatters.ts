/** Contract: contracts/app/rules.md */
import type { ReferenceData, ReferenceAuthor } from './types.ts';

/** Extract the year from an ISO date string or year-only string. */
export function extractYear(date?: string): string {
  if (!date) return 'n.d.';
  const match = date.match(/^(\d{4})/);
  return match ? match[1] : 'n.d.';
}

export function surname(a: ReferenceAuthor): string {
  return a.family ?? a.literal ?? 'Unknown';
}

export function formatAuthorApa(author: ReferenceAuthor): string {
  if (author.literal) return author.literal;
  const family = author.family ?? '';
  if (!author.given) return family;
  const initials = author.given
    .split(/[\s-]+/)
    .map((part) => `${part[0]}.`)
    .join(' ');
  return `${family}, ${initials}`;
}

function formatAuthorMla(author: ReferenceAuthor): string {
  if (author.literal) return author.literal;
  const family = author.family ?? '';
  if (!author.given) return family;
  return `${family}, ${author.given}`;
}

export function bibAuthorsApa(authors: ReferenceAuthor[]): string {
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

export function bibAuthorsMla(authors: ReferenceAuthor[]): string {
  if (authors.length === 0) return 'Unknown';
  if (authors.length === 1) return formatAuthorMla(authors[0]);
  if (authors.length === 2) {
    return `${formatAuthorMla(authors[0])}, and ${formatAuthorMla(authors[1])}`;
  }
  return `${formatAuthorMla(authors[0])}, et al.`;
}

export function bibAuthorsVancouver(authors: ReferenceAuthor[]): string {
  if (authors.length === 0) return 'Unknown';
  const fmt = (a: ReferenceAuthor) => {
    if (a.literal) return a.literal;
    const family = a.family ?? '';
    const initials = a.given
      ? a.given.split(/[\s-]+/).map((p) => p[0]).join('')
      : '';
    return `${family} ${initials}`;
  };
  if (authors.length <= 6) return authors.map(fmt).join(', ');
  return `${authors.slice(0, 6).map(fmt).join(', ')}, et al.`;
}

export function appendDoi(entry: string, ref: ReferenceData): string {
  if (ref.doi) return `${entry} https://doi.org/${ref.doi}`;
  if (ref.url) return `${entry} ${ref.url}`;
  return entry;
}
