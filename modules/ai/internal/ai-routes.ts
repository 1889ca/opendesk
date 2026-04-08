/** Contract: contracts/ai/rules.md */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AiModule } from '../contract.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';

const SemanticSearchQuery = z.object({
  q: z.string().min(2).max(500),
  limit: z.coerce.number().int().positive().max(50).optional().default(10),
});

const AskBody = z.object({
  question: z.string().min(2).max(1000),
});

const EmbedBody = z.object({
  documentId: z.string().uuid(),
});

export interface AiRoutesOptions {
  ai: AiModule;
  permissions: PermissionsModule;
}

/**
 * Mount AI routes onto a router.
 * All routes require authentication and respect document permissions.
 */
export function createAiRoutes(opts: AiRoutesOptions): Router {
  const { ai, permissions } = opts;
  const router = Router();

  // GET /api/ai/search?q=query — semantic search
  router.get(
    '/search',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = SemanticSearchQuery.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }

      const principal = req.principal!;
      const grants = await permissions.grantStore.findByPrincipal(principal.id);
      const allowedIds = grants
        .filter((g) => g.resourceType === 'document')
        .map((g) => g.resourceId);

      const results = await ai.semanticSearch(
        parsed.data.q,
        allowedIds,
        parsed.data.limit,
      );
      res.json(results);
    }),
  );

  // POST /api/ai/ask — RAG document assistant
  router.post(
    '/ask',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = AskBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }

      const principal = req.principal!;
      const grants = await permissions.grantStore.findByPrincipal(principal.id);
      const allowedIds = grants
        .filter((g) => g.resourceType === 'document')
        .map((g) => g.resourceId);

      const response = await ai.ask(parsed.data.question, allowedIds);
      res.json(response);
    }),
  );

  // POST /api/ai/embed — trigger embedding for a document
  router.post(
    '/embed',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = EmbedBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }

      // Require write permission on the document
      const principal = req.principal!;
      const allowed = await permissions.checkPermission(
        principal.id,
        parsed.data.documentId,
        'write',
      );
      if (!allowed) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const chunks = await ai.embedDocument(parsed.data.documentId);
      res.json({ ok: true, documentId: parsed.data.documentId, chunks });
    }),
  );

  // GET /api/ai/health — check Ollama connectivity
  router.get(
    '/health',
    permissions.requireAuth,
    asyncHandler(async (_req: Request, res: Response) => {
      const reachable = await ai.healthCheck();
      res.json({ ollama: reachable ? 'ok' : 'unavailable' });
    }),
  );

  return router;
}
