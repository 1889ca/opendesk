// TODO: Convert to integration tests with real DB (see contracts/testing/rules.md)
/** Contract: contracts/ai/rules.md */
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAiRoutes } from './ai-routes.ts';
import type { AiModule } from '../contract.ts';

function createStubAi(overrides: Partial<AiModule> = {}): AiModule {
  return {
    embedDocument: vi.fn(async () => 5),
    semanticSearch: vi.fn(async () => [
      { documentId: 'doc-1', title: 'Test Doc', chunkContent: 'relevant text', similarity: 0.92 },
    ]),
    ask: vi.fn(async () => ({
      answer: 'The answer is 42.',
      sources: [{ documentId: 'doc-1', title: 'Test', chunkContent: 'chunk', similarity: 0.9 }],
    })),
    healthCheck: vi.fn(async () => true),
    startConsumer: vi.fn(),
    stopConsumer: vi.fn(),
    ...overrides,
  };
}

function createStubPermissions() {
  return {
    requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
      (_req as { principal?: unknown }).principal = { id: 'user-1' };
      next();
    },
    require: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    requireForResource: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    checkPermission: vi.fn(async () => true),
    grantStore: {
      findByPrincipal: vi.fn(async () => [
        { resourceType: 'document', resourceId: 'doc-1' },
        { resourceType: 'document', resourceId: 'doc-2' },
      ]),
    },
  } as unknown as import('../../permissions/index.ts').PermissionsModule;
}

describe('AI routes', () => {
  it('GET /search returns semantic results', async () => {
    const ai = createStubAi();
    const app = express();
    app.use('/api/ai', createAiRoutes({ ai, permissions: createStubPermissions() }));

    const res = await request(app).get('/api/ai/search?q=test+query');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].documentId).toBe('doc-1');
    expect(res.body[0].similarity).toBe(0.92);
    expect(ai.semanticSearch).toHaveBeenCalledWith(
      'test query',
      ['doc-1', 'doc-2'],
      10,
    );
  });

  it('GET /search validates query length', async () => {
    const ai = createStubAi();
    const app = express();
    app.use('/api/ai', createAiRoutes({ ai, permissions: createStubPermissions() }));

    const res = await request(app).get('/api/ai/search?q=a');
    expect(res.status).toBe(400);
  });

  it('POST /ask returns assistant response', async () => {
    const ai = createStubAi();
    const app = express();
    app.use(express.json());
    app.use('/api/ai', createAiRoutes({ ai, permissions: createStubPermissions() }));

    const res = await request(app)
      .post('/api/ai/ask')
      .send({ question: 'What is the answer?' });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBe('The answer is 42.');
    expect(res.body.sources).toHaveLength(1);
  });

  it('POST /embed triggers embedding', async () => {
    const ai = createStubAi();
    const app = express();
    app.use(express.json());
    app.use('/api/ai', createAiRoutes({ ai, permissions: createStubPermissions() }));

    const res = await request(app)
      .post('/api/ai/embed')
      .send({ documentId: '550e8400-e29b-41d4-a716-446655440000' });

    expect(res.status).toBe(200);
    expect(res.body.chunks).toBe(5);
  });

  it('GET /health returns Ollama status', async () => {
    const ai = createStubAi();
    const app = express();
    app.use('/api/ai', createAiRoutes({ ai, permissions: createStubPermissions() }));

    const res = await request(app).get('/api/ai/health');

    expect(res.status).toBe(200);
    expect(res.body.ollama).toBe('ok');
  });

  it('GET /health reports unavailable when Ollama is down', async () => {
    const ai = createStubAi({ healthCheck: vi.fn(async () => false) });
    const app = express();
    app.use('/api/ai', createAiRoutes({ ai, permissions: createStubPermissions() }));

    const res = await request(app).get('/api/ai/health');

    expect(res.status).toBe(200);
    expect(res.body.ollama).toBe('unavailable');
  });
});
