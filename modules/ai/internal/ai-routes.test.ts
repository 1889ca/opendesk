/** Contract: contracts/ai/rules.md */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { createAiRoutes } from './ai-routes.ts';
import type { AiModule } from '../contract.ts';
import { createPermissions, type PermissionsModule } from '../../permissions/index.ts';

/** Middleware that attaches a real principal with admin scopes. */
function fakePrincipal(id = 'user-1') {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.principal = { id, actorType: 'human', displayName: 'Test User', scopes: ['*'] };
    next();
  };
}

/** In-memory AI module — uses vi.fn() spies (not vi.mock) for call tracking. */
function createInMemoryAi(overrides: Partial<AiModule> = {}): AiModule {
  return {
    embedDocument: vi.fn(async () => 5),
    semanticSearch: vi.fn(async () => [
      { sourceId: 'doc-1', sourceType: 'document' as const, chunkText: 'relevant text', similarity: 0.92 },
    ]),
    ask: vi.fn(async () => ({
      answer: 'The answer is 42.',
      sources: [{ sourceId: 'doc-1', sourceType: 'document' as const, chunkText: 'chunk', similarity: 0.9 }],
    })),
    assist: vi.fn(async () => ({ result: 'Transformed text.' })),
    healthCheck: vi.fn(async () => true),
    startConsumer: vi.fn(),
    stopConsumer: vi.fn(),
    ...overrides,
  };
}

function createTestApp(ai: AiModule, permissions: PermissionsModule) {
  const app = express();
  app.use(express.json());
  app.use(fakePrincipal());
  app.use('/api/ai', createAiRoutes({ ai, permissions }));
  return app;
}

describe('AI routes', () => {
  let permissions: PermissionsModule;

  beforeEach(async () => {
    permissions = createPermissions();
    // Grant document access so permission checks + grant lookups work
    await permissions.grantStore.create({
      principalId: 'user-1', resourceId: 'doc-1', resourceType: 'document',
      role: 'owner', grantedBy: 'user-1',
    });
    await permissions.grantStore.create({
      principalId: 'user-1', resourceId: 'doc-2', resourceType: 'document',
      role: 'owner', grantedBy: 'user-1',
    });
  });

  it('GET /search returns semantic results', async () => {
    const ai = createInMemoryAi();
    const app = createTestApp(ai, permissions);

    const res = await request(app).get('/api/ai/search?q=test+query');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].sourceId).toBe('doc-1');
    expect(ai.semanticSearch).toHaveBeenCalledWith(
      'test query',
      expect.arrayContaining(['doc-1', 'doc-2']),
      10,
    );
  });

  it('GET /search validates query length', async () => {
    const ai = createInMemoryAi();
    const app = createTestApp(ai, permissions);

    const res = await request(app).get('/api/ai/search?q=a');
    expect(res.status).toBe(400);
  });

  it('POST /ask returns assistant response', async () => {
    const ai = createInMemoryAi();
    const app = createTestApp(ai, permissions);

    const res = await request(app)
      .post('/api/ai/ask')
      .send({ question: 'What is the answer?' });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBe('The answer is 42.');
    expect(res.body.sources).toHaveLength(1);
  });

  it('POST /embed triggers embedding for permitted document', async () => {
    const docId = '550e8400-e29b-41d4-a716-446655440000';
    await permissions.grantStore.create({
      principalId: 'user-1', resourceId: docId, resourceType: 'document',
      role: 'editor', grantedBy: 'user-1',
    });
    const ai = createInMemoryAi();
    const app = createTestApp(ai, permissions);

    const res = await request(app)
      .post('/api/ai/embed')
      .send({ documentId: docId });

    expect(res.status).toBe(200);
    expect(res.body.chunks).toBe(5);
  });

  it('GET /health returns Ollama status', async () => {
    const ai = createInMemoryAi();
    const app = createTestApp(ai, permissions);

    const res = await request(app).get('/api/ai/health');
    expect(res.status).toBe(200);
    expect(res.body.ollama).toBe('ok');
  });

  it('GET /health reports unavailable when Ollama is down', async () => {
    const ai = createInMemoryAi({ healthCheck: vi.fn(async () => false) });
    const app = createTestApp(ai, permissions);

    const res = await request(app).get('/api/ai/health');
    expect(res.status).toBe(200);
    expect(res.body.ollama).toBe('unavailable');
  });

  it('POST /assist returns transformed text', async () => {
    const ai = createInMemoryAi({
      assist: vi.fn(async () => ({ result: 'Improved text here.' })),
    });
    const app = createTestApp(ai, permissions);

    const res = await request(app)
      .post('/api/ai/assist')
      .send({ action: 'improve', text: 'This is some text.' });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('Improved text here.');
    expect(ai.assist).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'improve', text: 'This is some text.' }),
    );
  });

  it('POST /assist rejects invalid action', async () => {
    const ai = createInMemoryAi();
    const app = createTestApp(ai, permissions);

    const res = await request(app)
      .post('/api/ai/assist')
      .send({ action: 'unknown-action', text: 'Hello' });

    expect(res.status).toBe(400);
  });

  it('POST /assist rejects empty text', async () => {
    const ai = createInMemoryAi();
    const app = createTestApp(ai, permissions);

    const res = await request(app)
      .post('/api/ai/assist')
      .send({ action: 'summarize', text: '' });

    expect(res.status).toBe(400);
  });
});

// --- Security fix #483: model zoo routes require admin auth ---

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
    // pullModel returns Promise<AsyncGenerator<PullProgress>>
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

  beforeEach(async () => {
    permissions = createPermissions();
  });

  /** App with NO principal attached — simulates unauthenticated request. */
  function createUnauthApp() {
    const modelService = createFakeModelService();
    const app = express();
    app.use(express.json());
    // No fakePrincipal() — request arrives without authentication
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
