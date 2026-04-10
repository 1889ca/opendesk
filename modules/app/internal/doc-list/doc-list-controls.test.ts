/** Contract: contracts/app/rules.md */

import { describe, it, expect, beforeAll } from 'vitest';
import { parseSortOption, buildApiUrl, type SortOption, type TypeFilter } from './doc-list-controls.ts';

// buildApiUrl uses `new URL(base, window.location.origin)` — stub it for Node.
beforeAll(() => {
  if (typeof globalThis.window === 'undefined') {
    (globalThis as Record<string, unknown>).window = {
      location: { origin: 'http://localhost' },
    };
  }
});

// ---------------------------------------------------------------------------
// parseSortOption
// ---------------------------------------------------------------------------

describe('parseSortOption', () => {
  it('splits updated_at-desc into field and direction', () => {
    expect(parseSortOption('updated_at-desc')).toEqual({ sort: 'updated_at', sortDir: 'desc' });
  });

  it('splits updated_at-asc into field and direction', () => {
    expect(parseSortOption('updated_at-asc')).toEqual({ sort: 'updated_at', sortDir: 'asc' });
  });

  it('splits created_at-desc correctly', () => {
    expect(parseSortOption('created_at-desc')).toEqual({ sort: 'created_at', sortDir: 'desc' });
  });

  it('splits created_at-asc correctly', () => {
    expect(parseSortOption('created_at-asc')).toEqual({ sort: 'created_at', sortDir: 'asc' });
  });

  it('splits title-asc correctly', () => {
    expect(parseSortOption('title-asc')).toEqual({ sort: 'title', sortDir: 'asc' });
  });

  it('splits title-desc correctly', () => {
    expect(parseSortOption('title-desc')).toEqual({ sort: 'title', sortDir: 'desc' });
  });
});

// ---------------------------------------------------------------------------
// buildApiUrl
// ---------------------------------------------------------------------------

describe('buildApiUrl', () => {
  const baseUrl = '/api/documents';

  it('includes sort, sortDir, page, and limit params', () => {
    const url = buildApiUrl(baseUrl, { sort: 'updated_at-desc', typeFilter: 'all', page: 1 });
    expect(url).toContain('sort=updated_at');
    expect(url).toContain('sortDir=desc');
    expect(url).toContain('page=1');
    expect(url).toContain('limit=20');
  });

  it('does not include type param when typeFilter is "all"', () => {
    const url = buildApiUrl(baseUrl, { sort: 'title-asc', typeFilter: 'all', page: 1 });
    expect(url).not.toContain('type=');
  });

  it('includes type param when typeFilter is "text"', () => {
    const url = buildApiUrl(baseUrl, { sort: 'title-asc', typeFilter: 'text', page: 1 });
    expect(url).toContain('type=text');
  });

  it('includes type param when typeFilter is "spreadsheet"', () => {
    const url = buildApiUrl(baseUrl, { sort: 'title-asc', typeFilter: 'spreadsheet', page: 1 });
    expect(url).toContain('type=spreadsheet');
  });

  it('includes type param when typeFilter is "presentation"', () => {
    const url = buildApiUrl(baseUrl, { sort: 'title-asc', typeFilter: 'presentation', page: 1 });
    expect(url).toContain('type=presentation');
  });

  it('reflects correct page number in params', () => {
    const url = buildApiUrl(baseUrl, { sort: 'created_at-asc', typeFilter: 'all', page: 5 });
    expect(url).toContain('page=5');
  });

  it('uses correct sort field for created_at-asc', () => {
    const url = buildApiUrl(baseUrl, { sort: 'created_at-asc', typeFilter: 'all', page: 1 });
    expect(url).toContain('sort=created_at');
    expect(url).toContain('sortDir=asc');
  });

  it('returns a path+query string without origin', () => {
    const url = buildApiUrl(baseUrl, { sort: 'title-desc', typeFilter: 'all', page: 1 });
    expect(url).toMatch(/^\/api\/documents\?/);
  });

  it('combines all params correctly for a type-filtered page 3 request', () => {
    const url = buildApiUrl(baseUrl, { sort: 'updated_at-asc', typeFilter: 'text', page: 3 });
    const parsed = new URL(url, 'http://localhost');
    expect(parsed.searchParams.get('sort')).toBe('updated_at');
    expect(parsed.searchParams.get('sortDir')).toBe('asc');
    expect(parsed.searchParams.get('page')).toBe('3');
    expect(parsed.searchParams.get('limit')).toBe('20');
    expect(parsed.searchParams.get('type')).toBe('text');
  });
});
