/** Contract: contracts/document/rules.md */
import { describe, it, expect } from 'vitest';
import { createSearchRoutes, type SearchFn } from './search-routes.ts';
import { createPermissions } from '../../permissions/index.ts';

const fakeSearch: SearchFn = async (query, _allowedIds) => {
  if (query === 'match') {
    return [
      {
        id: 'doc-1',
        title: 'Match Doc',
        snippet: '<mark>Match</mark> found here',
        rank: 0.8,
        updated_at: new Date(),
      },
    ];
  }
  return [];
};

describe('search routes', () => {
  it('creates a router with search endpoint', () => {
    const permissions = createPermissions();
    const router = createSearchRoutes({ permissions, searchDocuments: fakeSearch });
    expect(router).toBeDefined();
    expect(router.stack.length).toBeGreaterThan(0);
  });

  it('has a GET /search route', () => {
    const permissions = createPermissions();
    const router = createSearchRoutes({ permissions, searchDocuments: fakeSearch });
    const searchRoute = router.stack.find((layer: any) =>
      layer.route?.path === '/search' && layer.route?.methods?.get,
    );
    expect(searchRoute).toBeDefined();
  });
});
