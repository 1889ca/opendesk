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
import type { AuthMode } from '../../config/contract.ts';
import { asyncHandler } from './async-handler.ts';
import type { PermissionsModule } from '../../permissions/index.ts';

const RESOURCE_TYPE = 'template';

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
  authMode?: AuthMode;
};

/**
 * Mount template CRUD routes onto a router.
 * Enforces ownership-based resource-level authorization.
 */
export function createTemplateRoutes(opts: TemplateRoutesOptions): Router {
  const { permissions, authMode } = opts;
  const router = Router();
  const requireRead = permissions.requireForResource('read', RESOURCE_TYPE);
  const requireWrite = permissions.requireForResource('write', RESOURCE_TYPE);
  const requireDelete = permissions.requireForResource('delete', RESOURCE_TYPE);

  // List all templates — returns all (templates are shared), annotates ownership
  router.get('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const templates = await listTemplates();

    if (authMode === 'dev') {
      res.json(templates.map((t) => ({ ...t, isOwner: true })));
      return;
    }

    const principal = req.principal!;
    const grants = await permissions.grantStore.findByPrincipal(principal.id);
    const ownedIds = new Set(
      grants
        .filter((g) => g.resourceType === RESOURCE_TYPE && g.role === 'owner')
        .map((g) => g.resourceId),
    );
    res.json(templates.map((t) => ({ ...t, isOwner: ownedIds.has(t.id) })));
  }));

  // Create a template — auto-grants owner role to creator
  router.post('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const bodyResult = CreateTemplateBody.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }
    const { name, description, content } = bodyResult.data;
    const id = randomUUID();
    const template = await createTemplate(id, name, description, content);

    const principal = req.principal!;
    await permissions.grantStore.create({
      principalId: principal.id,
      resourceId: id,
      resourceType: RESOURCE_TYPE,
      role: 'owner',
      grantedBy: principal.id,
    });

    res.status(201).json(template);
  }));

  // Get a single template — requires read permission
  router.get('/:id', requireRead, asyncHandler(async (req: Request, res: Response) => {
    const template = await getTemplate(String(req.params.id));
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json(template);
  }));

  // Update a template — requires write permission
  router.put('/:id', requireWrite, asyncHandler(async (req: Request, res: Response) => {
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

  // Delete a template — requires delete permission, cleans up grants
  router.delete('/:id', requireDelete, asyncHandler(async (req: Request, res: Response) => {
    const templateId = String(req.params.id);
    const deleted = await deleteTemplate(templateId);
    if (!deleted) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    await permissions.grantStore.deleteByResource(templateId, RESOURCE_TYPE);

    res.json({ ok: true, deletedAt: new Date().toISOString(), templateId });
  }));

  return router;
}
