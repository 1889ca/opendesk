/** Contract: contracts/references/rules.md */

/**
 * DOI and ISBN lookup services.
 * Fetches metadata from CrossRef and OpenLibrary, transforms to Reference shape.
 */

export type LookupResult = {
  title: string;
  authors: string[];
  year: number | null;
  source: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  isbn: string | null;
  url: string | null;
  publisher: string | null;
  type: 'article' | 'book' | 'chapter' | 'website' | 'other';
};

export type LookupError = {
  code: 'NOT_FOUND' | 'TIMEOUT' | 'UPSTREAM_ERROR' | 'INVALID_INPUT';
  message: string;
};

export type LookupResponse =
  | { ok: true; data: LookupResult }
  | { ok: false; error: LookupError };

const CROSSREF_BASE = 'https://api.crossref.org/works';
const OPENLIBRARY_BASE = 'https://openlibrary.org/isbn';
const FETCH_TIMEOUT_MS = 10_000;

// --- CrossRef transformation ---

type CrossRefAuthor = { given?: string; family?: string };

type CrossRefWork = {
  title?: string[];
  author?: CrossRefAuthor[];
  'published-print'?: { 'date-parts'?: number[][] };
  'published-online'?: { 'date-parts'?: number[][] };
  'container-title'?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  DOI?: string;
  URL?: string;
  publisher?: string;
  type?: string;
};

export function transformCrossRefResponse(work: CrossRefWork): LookupResult {
  const title = work.title?.[0] ?? 'Untitled';

  const authors = (work.author ?? []).map((a) => {
    const parts = [a.given, a.family].filter(Boolean);
    return parts.join(' ');
  });

  const dateParts =
    work['published-print']?.['date-parts']?.[0] ??
    work['published-online']?.['date-parts']?.[0];
  const year = dateParts?.[0] ?? null;

  const crossRefType = work.type ?? '';
  const type = mapCrossRefType(crossRefType);

  return {
    title,
    authors,
    year,
    source: work['container-title']?.[0] ?? null,
    volume: work.volume ?? null,
    issue: work.issue ?? null,
    pages: work.page ?? null,
    doi: work.DOI ?? null,
    isbn: null,
    url: work.URL ?? null,
    publisher: work.publisher ?? null,
    type,
  };
}

function mapCrossRefType(t: string): LookupResult['type'] {
  if (t.includes('journal') || t.includes('article')) return 'article';
  if (t.includes('book') && t.includes('chapter')) return 'chapter';
  if (t.includes('book') || t.includes('monograph')) return 'book';
  return 'other';
}

// --- OpenLibrary transformation ---

type OpenLibraryBook = {
  title?: string;
  authors?: Array<{ key?: string; name?: string }>;
  publish_date?: string;
  publishers?: string[];
  isbn_13?: string[];
  isbn_10?: string[];
  url?: string;
  number_of_pages?: number;
};

export function transformOpenLibraryResponse(book: OpenLibraryBook, isbn: string): LookupResult {
  const title = book.title ?? 'Untitled';

  const authors = (book.authors ?? [])
    .map((a) => a.name)
    .filter((n): n is string => Boolean(n));

  const yearMatch = book.publish_date?.match(/\d{4}/);
  const year = yearMatch ? Number(yearMatch[0]) : null;

  return {
    title,
    authors,
    year,
    source: null,
    volume: null,
    issue: null,
    pages: null,
    doi: null,
    isbn: book.isbn_13?.[0] ?? book.isbn_10?.[0] ?? isbn,
    url: null,
    publisher: book.publishers?.[0] ?? null,
    type: 'book',
  };
}

// --- Fetch helpers ---

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'OpenDesk/1.0 (mailto:admin@opendesk.local)' },
    });
  } finally {
    clearTimeout(timer);
  }
}

// --- Public API ---

export async function lookupDOI(doi: string): Promise<LookupResponse> {
  const trimmed = doi.trim();
  if (!trimmed) {
    return { ok: false, error: { code: 'INVALID_INPUT', message: 'DOI is empty' } };
  }

  try {
    const res = await fetchWithTimeout(`${CROSSREF_BASE}/${encodeURIComponent(trimmed)}`);
    if (res.status === 404) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `DOI not found: ${trimmed}` } };
    }
    if (!res.ok) {
      return { ok: false, error: { code: 'UPSTREAM_ERROR', message: `CrossRef returned ${res.status}` } };
    }
    const json = await res.json() as { message: CrossRefWork };
    return { ok: true, data: transformCrossRefResponse(json.message) };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: { code: 'TIMEOUT', message: 'CrossRef request timed out' } };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: { code: 'UPSTREAM_ERROR', message: msg } };
  }
}

export async function lookupISBN(isbn: string): Promise<LookupResponse> {
  const trimmed = isbn.replace(/[-\s]/g, '').trim();
  if (!trimmed) {
    return { ok: false, error: { code: 'INVALID_INPUT', message: 'ISBN is empty' } };
  }

  try {
    const res = await fetchWithTimeout(`${OPENLIBRARY_BASE}/${encodeURIComponent(trimmed)}.json`);
    if (res.status === 404) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `ISBN not found: ${trimmed}` } };
    }
    if (!res.ok) {
      return { ok: false, error: { code: 'UPSTREAM_ERROR', message: `OpenLibrary returned ${res.status}` } };
    }
    const json = await res.json() as OpenLibraryBook;
    return { ok: true, data: transformOpenLibraryResponse(json, trimmed) };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: { code: 'TIMEOUT', message: 'OpenLibrary request timed out' } };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: { code: 'UPSTREAM_ERROR', message: msg } };
  }
}
