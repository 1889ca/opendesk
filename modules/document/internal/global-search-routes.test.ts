/** Contract: contracts/document/rules.md */
import { describe, it, expect } from 'vitest';
import { createGlobalSearchRoutes, type GlobalSearchFn } from './global-search-routes.ts';
import { createPermissions } from '../../permissions/index.ts';

const fakeSearch: GlobalSearchFn = async (query, _allowedIds) => {
  if (query === 'budget') {
    return [
      {
        id: 'doc-1',
        title: 'Budget Report',
        snippet: '<mark>Budget</mark> report for Q1',
        rank: 0.9,
        content_type: 'document',
        updated_at: new Date(),
      },
      {
        id: 'sheet-1',
        title: 'Budget Spreadsheet',
        snippet: '<mark>Budget</mark> data',
        rank: 0.7,
        content_type: 'spreadsheet',
        updated_at: new Date(),
      },
    ];
  }
  return [];
};

describe('global search routes', () => {
  it('creates a router with search endpoint', () => {
    const permissions = createPermissions();
    const router = createGlobalSearchRoutes({
      permissions,
      globalSearch: fakeSearch,
    });
    expect(router).toBeDefined();
    expect(router.stack.length).toBeGreaterThan(0);
  });

  it('has a GET / route', () => {
    const permissions = createPermissions();
    const router = createGlobalSearchRoutes({
      permissions,
      globalSearch: fakeSearch,
    });
    const route = router.stack.find(
      (layer: any) => layer.route?.path === '/' && layer.route?.methods?.get,
    );
    expect(route).toBeDefined();
  });
});
