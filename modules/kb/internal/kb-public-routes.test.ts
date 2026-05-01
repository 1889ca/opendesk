/** Contract: contracts/kb/rules.md */

/**
 * Security tests for KB public routes.
 * Verifies that toggling KB public access requires admin privileges (#484).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { createPermissions, type PermissionsModule } from '../../permissions/index.ts';

// Mock pool and entries-store so tests don't require a real database.
vi.mock('../../storage/internal/pool.ts', () => ({
  pool: {
    query: vi.fn(async () => ({ rows: [{ is_public: false }] })),
  },
}));

vi.mock('./entries-store.ts', () => ({
  listEntries: vi.fn(async () => []),
}));

// Import AFTER mocks are registered.
const { createKBPublicRoutes } = await import('./kb-public-routes.ts');

function createApp(permissions: PermissionsModule, principalScopes: string[] | null) {
  const app = express();
  app.use(express.json());

  if (principalScopes !== null) {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.principal = {
        id: 'user-1',
        actorType: 'human',
        displayName: 'Test User',
        scopes: principalScopes,
      };
      next();
    });
  }
  // No principal middleware → simulates unauthenticated

  app.use('/api/kb', createKBPublicRoutes({ permissions }));
  return app;
}

describe('KB public routes — security #484', () => {
  let permissions: PermissionsModule;

  beforeEach(() => {
    permissions = createPermissions();
    vi.clearAllMocks();
  });

  it('POST /settings returns 401 for unauthenticated request', async () => {
    const app = createApp(permissions, null);
    const res = await request(app)
      .post('/api/kb/settings')
      .send({ is_public: true });
    expect(res.status).toBe(401);
  });

  it('POST /settings returns 403 for authenticated non-admin user', async () => {
    const app = createApp(permissions, []); // empty scopes = not admin
    const res = await request(app)
      .post('/api/kb/settings')
      .send({ is_public: true });
    expect(res.status).toBe(403);
  });

  it('POST /settings returns 403 for user with editor scope but not admin', async () => {
    const app = createApp(permissions, ['editor']);
    const res = await request(app)
      .post('/api/kb/settings')
      .send({ is_public: true });
    expect(res.status).toBe(403);
  });

  it('GET /settings is accessible to any authenticated user', async () => {
    const app = createApp(permissions, []); // authenticated but not admin
    const res = await request(app).get('/api/kb/settings');
    expect(res.status).toBe(200);
  });

  it('GET /public is accessible without authentication', async () => {
    const app = createApp(permissions, null); // unauthenticated
    const res = await request(app).get('/api/kb/public');
    // KB is not public (mocked as is_public: false), so 403 from business logic
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('This knowledge base is not publicly accessible');
  });
});
