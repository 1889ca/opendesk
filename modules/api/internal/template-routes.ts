/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
} from '../../storage/index.ts';
import { asyncHandler } from './async-handler.ts';
import type { PermissionsModule } from '../../permissions/index.ts';

const CreateTemplateBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(''),
  content: z.record(z.unknown()).optional().default({}),
});

const UpdateTemplateBody = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  content: z.record(z.unknown()).optional(),
});

export type TemplateRoutesOptions = {
  permissions: PermissionsModule;
};

/**
 * Mount template CRUD routes onto a router.
 */
export function createTemplateRoutes(opts: TemplateRoutesOptions): Router {
  const { permissions } = opts;
  const router = Router();

  // List all templates
  router.get('/', asyncHandler(async (_req: Request, res: Response) => {
    const templates = await listTemplates();
    res.json(templates);
  }));

  // Create a template
  router.post('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const bodyResult = CreateTemplateBody.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }
    const { name, description, content } = bodyResult.data;
    const id = randomUUID();
    const template = await createTemplate(id, name, description, content);
    res.status(201).json(template);
  }));

  // Get a single template
  router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const template = await getTemplate(String(req.params.id));
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json(template);
  }));

  // Update a template
  router.put('/:id', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const bodyResult = UpdateTemplateBody.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }
    const { name, description, content } = bodyResult.data;
    const updated = await updateTemplate(String(req.params.id), {
      name,
      description,
      content,
    });
    if (!updated) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json(updated);
  }));

  // Delete a template
  router.delete('/:id', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const deleted = await deleteTemplate(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json({ ok: true });
  }));

  return router;
}
