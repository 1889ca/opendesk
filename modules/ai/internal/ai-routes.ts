/** Contract: contracts/ai/rules.md */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { CustomModelSchema } from '../contract.ts';
import type { ModelService } from './model-service.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';

export type AiRoutesOpts = {
  modelService: ModelService;
};

/** Mount AI model management routes under /api/ai. */
export function createAiRoutes(opts: AiRoutesOpts): Router {
  const router = Router();
  const { modelService } = opts;

  // GET /api/ai/models — list all models with install status
  router.get(
    '/models',
    asyncHandler(async (_req: Request, res: Response) => {
      const models = await modelService.listModels();
      const config = await modelService.getConfig();
      res.json({ models, config });
    }),
  );

  // POST /api/ai/models/:id/pull — trigger Ollama pull (streamed progress)
  router.post(
    '/models/:id/pull',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const generator = await modelService.pullModel(id);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      for await (const progress of generator) {
        res.write(`data: ${JSON.stringify(progress)}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ status: 'success' })}\n\n`);
      res.end();
    }),
  );

  // DELETE /api/ai/models/:id — remove model from Ollama
  router.delete(
    '/models/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      await modelService.deleteModel(id);
      res.json({ ok: true });
    }),
  );

  // GET /api/ai/models/:id/status — check if model is installed
  router.get(
    '/models/:id/status',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const models = await modelService.listModels();
      const model = models.find((m) => m.id === id);
      if (!model) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }
      res.json({ id: model.id, installed: model.installed });
    }),
  );

  // PUT /api/ai/config — set active model for embedding or generation
  router.put(
    '/config',
    asyncHandler(async (req: Request, res: Response) => {
      const schema = z.object({
        role: z.enum(['embedding', 'generation']),
        modelId: z.string().min(1),
        workspaceId: z.string().default('default'),
      });
      const parsed = schema.parse(req.body);
      const config = await modelService.setActive(
        parsed.workspaceId,
        parsed.role,
        parsed.modelId,
      );
      res.json(config);
    }),
  );

  // POST /api/ai/models/custom — register a custom model
  router.post(
    '/models/custom',
    asyncHandler(async (req: Request, res: Response) => {
      const model = CustomModelSchema.parse(req.body);
      await modelService.registerCustom(model);
      res.status(201).json({ ok: true, id: model.id });
    }),
  );

  // DELETE /api/ai/models/custom/:id — remove a custom model
  router.delete(
    '/models/custom/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const removed = await modelService.unregisterCustom(req.params.id);
      if (!removed) {
        res.status(404).json({ error: 'Custom model not found' });
        return;
      }
      res.json({ ok: true });
    }),
  );

  return router;
}
