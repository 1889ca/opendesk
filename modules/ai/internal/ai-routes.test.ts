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

  it('POST /assist passes scoped context to the AI module', async () => {
    const ai = createInMemoryAi({
      assist: vi.fn(async () => ({ result: 'Context-aware result.' })),
    });
    const app = createTestApp(ai, permissions);

    const context = { type: 'selection', label: 'Selection', content: 'surrounding paragraph text' };
    const res = await request(app)
      .post('/api/ai/assist')
      .send({ action: 'summarize', text: 'Selected sentence.', context });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('Context-aware result.');
    expect(ai.assist).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'summarize',
        text: 'Selected sentence.',
        context: expect.objectContaining({ type: 'selection', label: 'Selection' }),
      }),
    );
  });

  it('POST /assist rejects unknown context type', async () => {
    const ai = createInMemoryAi();
    const app = createTestApp(ai, permissions);

    const res = await request(app)
      .post('/api/ai/assist')
      .send({ action: 'improve', text: 'Some text.', context: { type: 'unknown-type', label: 'Bad' } });

    expect(res.status).toBe(400);
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

// Security tests for model zoo routes (#483) live in ai-zoo-auth.test.ts.
