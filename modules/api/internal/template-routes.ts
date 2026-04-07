/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
} from '../../storage/index.ts';
import { asyncHandler } from './async-handler.ts';

/**
 * Mount template CRUD routes onto a router.
 * Auth checks are skipped for now (admin-only in the future).
 */
export function createTemplateRoutes(): Router {
  const router = Router();

  // List all templates
  router.get('/', asyncHandler(async (_req: Request, res: Response) => {
    const templates = await listTemplates();
    res.json(templates);
  }));

  // Create a template
  router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const { name, description, content } = req.body ?? {};
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const id = randomUUID();
    const template = await createTemplate(
      id,
      name,
      description || '',
      content || {},
    );
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
  router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
    const { name, description, content } = req.body ?? {};
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
  router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
    const deleted = await deleteTemplate(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json({ ok: true });
  }));

  return router;
}
