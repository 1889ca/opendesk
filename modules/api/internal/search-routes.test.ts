/** Contract: contracts/api/rules.md */
import { describe, it, expect, vi } from 'vitest';
import { createSearchRoutes } from './search-routes.ts';
import { createPermissions } from '../../permissions/index.ts';

// Stub the storage module to avoid real PG connections
vi.mock('../../storage/index.ts', () => ({
  searchDocuments: vi.fn(async (query: string, _allowedIds?: string[]) => {
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
  }),
}));

describe('search routes', () => {
  it('creates a router with search endpoint', () => {
    const permissions = createPermissions();
    const router = createSearchRoutes({ permissions });
    expect(router).toBeDefined();
    expect(router.stack.length).toBeGreaterThan(0);
  });

  it('has a GET /search route', () => {
    const permissions = createPermissions();
    const router = createSearchRoutes({ permissions });
    const searchRoute = router.stack.find((layer: any) =>
      layer.route?.path === '/search' && layer.route?.methods?.get,
    );
    expect(searchRoute).toBeDefined();
  });
});
