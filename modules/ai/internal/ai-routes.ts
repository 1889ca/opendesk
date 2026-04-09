/** Contract: contracts/ai/rules.md */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { CustomModelSchema, type AiModule } from '../contract.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import type { ModelService } from './model-service.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';

const SemanticSearchQuery = z.object({
  q: z.string().min(2).max(500),
  limit: z.coerce.number().int().positive().max(50).optional().default(10),
});

const AskBody = z.object({ question: z.string().min(2).max(1000) });
const EmbedBody = z.object({ documentId: z.string().uuid() });

export interface AiRoutesOptions {
  ai?: AiModule;
  permissions?: PermissionsModule;
  modelService?: ModelService;
}

/** Mount AI routes (RAG + model zoo management) under /api/ai. */
export function createAiRoutes(opts: AiRoutesOptions): Router {
  const { ai, permissions, modelService } = opts;
  const router = Router();

  // --- RAG routes (require ai + permissions) ---

  if (ai && permissions) {
    router.get('/search', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
      const parsed = SemanticSearchQuery.safeParse(req.query);
      if (!parsed.success) { res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues }); return; }
      const principal = req.principal!;
      const grants = await permissions.grantStore.findByPrincipal(principal.id);
      const allowedIds = grants.filter((g) => g.resourceType === 'document').map((g) => g.resourceId);
      res.json(await ai.semanticSearch(parsed.data.q, allowedIds, parsed.data.limit));
    }));

    router.post('/ask', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
      const parsed = AskBody.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues }); return; }
      const principal = req.principal!;
      const grants = await permissions.grantStore.findByPrincipal(principal.id);
      const allowedIds = grants.filter((g) => g.resourceType === 'document').map((g) => g.resourceId);
      res.json(await ai.ask(parsed.data.question, allowedIds));
    }));

    router.post('/embed', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
      const parsed = EmbedBody.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues }); return; }
      const principal = req.principal!;
      const allowed = await permissions.checkPermission(principal.id, parsed.data.documentId, 'write');
      if (!allowed) { res.status(403).json({ error: 'Forbidden' }); return; }
      const chunks = await ai.embedDocument(parsed.data.documentId);
      res.json({ ok: true, documentId: parsed.data.documentId, chunks });
    }));

    router.get('/health', permissions.requireAuth, asyncHandler(async (_req: Request, res: Response) => {
      const reachable = await ai.healthCheck();
      res.json({ ollama: reachable ? 'ok' : 'unavailable' });
    }));
  }

  // --- Model zoo routes (require modelService) ---

  if (modelService) {
    router.get('/models', asyncHandler(async (_req: Request, res: Response) => {
      const models = await modelService.listModels();
      const config = await modelService.getConfig();
      res.json({ models, config });
    }));

    router.post('/models/:id/pull', asyncHandler(async (req: Request, res: Response) => {
      const generator = await modelService.pullModel(String(req.params.id));
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      for await (const progress of generator) {
        res.write(`data: ${JSON.stringify(progress)}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ status: 'success' })}\n\n`);
      res.end();
    }));

    router.delete('/models/:id', asyncHandler(async (req: Request, res: Response) => {
      await modelService.deleteModel(String(req.params.id));
      res.json({ ok: true });
    }));

    router.get('/models/:id/status', asyncHandler(async (req: Request, res: Response) => {
      const models = await modelService.listModels();
      const model = models.find((m) => m.id === String(req.params.id));
      if (!model) { res.status(404).json({ error: 'Model not found' }); return; }
      res.json({ id: model.id, installed: model.installed });
    }));

    router.put('/config', asyncHandler(async (req: Request, res: Response) => {
      const schema = z.object({
        role: z.enum(['embedding', 'generation']),
        modelId: z.string().min(1),
        workspaceId: z.string().default('default'),
      });
      const parsed = schema.parse(req.body);
      const config = await modelService.setActive(parsed.workspaceId, parsed.role, parsed.modelId);
      res.json(config);
    }));

    router.post('/models/custom', asyncHandler(async (req: Request, res: Response) => {
      const model = CustomModelSchema.parse(req.body);
      await modelService.registerCustom(model);
      res.status(201).json({ ok: true, id: model.id });
    }));

    router.delete('/models/custom/:id', asyncHandler(async (req: Request, res: Response) => {
      const removed = await modelService.unregisterCustom(String(req.params.id));
      if (!removed) { res.status(404).json({ error: 'Custom model not found' }); return; }
      res.json({ ok: true });
    }));
  }

  return router;
}
