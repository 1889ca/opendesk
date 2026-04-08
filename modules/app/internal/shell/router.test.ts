/** Contract: contracts/app/shell.md */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchRoute, type Route } from './router.ts';

const routes: Route[] = [
  { pattern: '/', handler: vi.fn() },
  { pattern: '/doc/:id', handler: vi.fn() },
  { pattern: '/sheet/:id', handler: vi.fn() },
  { pattern: '/slides/:id', handler: vi.fn() },
  { pattern: '/settings', handler: vi.fn() },
];

beforeEach(() => {
  for (const r of routes) {
    (r.handler as ReturnType<typeof vi.fn>).mockClear();
  }
});

describe('matchRoute', () => {
  it('matches the root path', () => {
    const result = matchRoute('/', routes);
    expect(result).not.toBeNull();
    expect(result!.route.pattern).toBe('/');
    expect(result!.params).toEqual({});
  });

  it('matches parameterized routes', () => {
    const result = matchRoute('/doc/abc-123', routes);
    expect(result).not.toBeNull();
    expect(result!.route.pattern).toBe('/doc/:id');
    expect(result!.params).toEqual({ id: 'abc-123' });
  });

  it('matches different parameterized routes', () => {
    const sheet = matchRoute('/sheet/xyz', routes);
    expect(sheet).not.toBeNull();
    expect(sheet!.route.pattern).toBe('/sheet/:id');
    expect(sheet!.params).toEqual({ id: 'xyz' });

    const slides = matchRoute('/slides/pres-1', routes);
    expect(slides).not.toBeNull();
    expect(slides!.route.pattern).toBe('/slides/:id');
    expect(slides!.params).toEqual({ id: 'pres-1' });
  });

  it('matches static routes without params', () => {
    const result = matchRoute('/settings', routes);
    expect(result).not.toBeNull();
    expect(result!.route.pattern).toBe('/settings');
    expect(result!.params).toEqual({});
  });

  it('returns null for unmatched paths', () => {
    expect(matchRoute('/unknown', routes)).toBeNull();
    expect(matchRoute('/doc', routes)).toBeNull();
    expect(matchRoute('/doc/abc/extra', routes)).toBeNull();
  });

  it('strips query strings before matching', () => {
    const result = matchRoute('/doc/123?mode=edit', routes);
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ id: '123' });
  });

  it('strips hash fragments before matching', () => {
    const result = matchRoute('/doc/123#section', routes);
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ id: '123' });
  });

  it('handles trailing slashes', () => {
    const result = matchRoute('/doc/123/', routes);
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ id: '123' });
  });

  it('decodes URI-encoded parameters', () => {
    const result = matchRoute('/doc/hello%20world', routes);
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ id: 'hello world' });
  });

  it('returns the first matching route', () => {
    const overlapping: Route[] = [
      { pattern: '/doc/:id', handler: vi.fn() },
      { pattern: '/doc/:slug', handler: vi.fn() },
    ];
    const result = matchRoute('/doc/test', overlapping);
    expect(result).not.toBeNull();
    expect(result!.route).toBe(overlapping[0]);
    expect(result!.params).toEqual({ id: 'test' });
  });

  it('handles empty route list', () => {
    expect(matchRoute('/', [])).toBeNull();
  });

  it('handles special characters in params', () => {
    const result = matchRoute('/doc/abc%2Fdef', routes);
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ id: 'abc/def' });
  });

  it('does not match partial segments', () => {
    // '/doc' should not match '/doc/:id' (missing param)
    expect(matchRoute('/doc', routes)).toBeNull();
  });
});

describe('matchRoute with multi-segment patterns', () => {
  const multiRoutes: Route[] = [
    { pattern: '/org/:orgId/doc/:docId', handler: vi.fn() },
  ];

  it('extracts multiple params', () => {
    const result = matchRoute('/org/acme/doc/report-1', multiRoutes);
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ orgId: 'acme', docId: 'report-1' });
  });

  it('rejects paths with missing segments', () => {
    expect(matchRoute('/org/acme/doc', multiRoutes)).toBeNull();
    expect(matchRoute('/org/acme', multiRoutes)).toBeNull();
  });
});
