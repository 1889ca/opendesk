/** Contract: contracts/ai/rules.md */

/**
 * Security tests for model zoo routes — issue #483.
 * Verifies that all zoo management endpoints require admin authentication.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { createAiRoutes } from './ai-routes.ts';
import { createPermissions, type PermissionsModule } from '../../permissions/index.ts';

/** Minimal ModelService stub for route mounting. */
function createFakeModelService() {
  async function* emptyGen() {}
  return {
    listModels: vi.fn(async () => []),
    getConfig: vi.fn(async () => ({
      workspaceId: 'default',
      embeddingModel: null as string | null,
      generationModel: null as string | null,
      updatedAt: new Date(),
    })),
    pullModel: vi.fn(async (_id: string) => emptyGen()),
    deleteModel: vi.fn(async (_id: string) => {}),
    setActive: vi.fn(async (_ws: string, _role: 'embedding' | 'generation', _id: string) => ({
      workspaceId: 'default',
      embeddingModel: null as string | null,
      generationModel: null as string | null,
      updatedAt: new Date(),
    })),
    registerCustom: vi.fn(async () => {}),
    unregisterCustom: vi.fn(async (_id: string) => true as boolean),
  };
}

describe('AI model zoo routes — security #483', () => {
  let permissions: PermissionsModule;

  beforeEach(() => {
    permissions = createPermissions();
  });

  /** App with NO principal — simulates unauthenticated request. */
  function createUnauthApp() {
    const modelService = createFakeModelService();
    const app = express();
    app.use(express.json());
    app.use('/api/ai', createAiRoutes({ permissions, modelService }));
    return app;
  }

  /** App with a non-admin principal (no wildcard scope). */
  function createNonAdminApp() {
    const modelService = createFakeModelService();
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.principal = { id: 'user-1', actorType: 'human', displayName: 'Regular User', scopes: [] };
      next();
    });
    app.use('/api/ai', createAiRoutes({ permissions, modelService }));
    return app;
  }

  it('GET /models rejects unauthenticated request with 401', async () => {
    const res = await request(createUnauthApp()).get('/api/ai/models');
    expect(res.status).toBe(401);
  });

  it('GET /models rejects non-admin user with 403', async () => {
    const res = await request(createNonAdminApp()).get('/api/ai/models');
    expect(res.status).toBe(403);
  });

  it('DELETE /models/:id rejects unauthenticated request with 401', async () => {
    const res = await request(createUnauthApp()).delete('/api/ai/models/some-model');
    expect(res.status).toBe(401);
  });

  it('PUT /config rejects unauthenticated request with 401', async () => {
    const res = await request(createUnauthApp())
      .put('/api/ai/config')
      .send({ role: 'embedding', modelId: 'llama3' });
    expect(res.status).toBe(401);
  });

  it('POST /models/custom rejects non-admin user with 403', async () => {
    const res = await request(createNonAdminApp())
      .post('/api/ai/models/custom')
      .send({ id: 'my-model', name: 'My Model', ollamaTag: 'my-model:latest', capability: 'generate' });
    expect(res.status).toBe(403);
  });

  it('DELETE /models/custom/:id rejects non-admin user with 403', async () => {
    const res = await request(createNonAdminApp()).delete('/api/ai/models/custom/my-model');
    expect(res.status).toBe(403);
  });
});
