/** Contract: contracts/workflow/rules.md */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import { CreateWorkflowSchema, UpdateWorkflowSchema, type WorkflowModule } from '../contract.ts';
import { asyncHandler } from '../../api/index.ts';

export type WorkflowRoutesOptions = {
  permissions: PermissionsModule;
  workflowModule: WorkflowModule;
};

export function createWorkflowRoutes(opts: WorkflowRoutesOptions): Router {
  const router = Router();
  const { permissions, workflowModule } = opts;

  // List all workflows (admin overview for workflow editor)
  router.get(
    '/all',
    permissions.requireAuth,
    asyncHandler(async (_req: Request, res: Response) => {
      const defs = await workflowModule.listAllDefinitions();
      res.json(defs);
    }),
  );

  // Create workflow definition
  router.post(
    '/',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const bodyResult = CreateWorkflowSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
        return;
      }
      const { documentId } = bodyResult.data;
      const principal = req.principal!;

      const allowed = await permissions.checkPermission(principal.id, documentId, 'manage');
      if (!allowed) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Requires manage permission' });
        return;
      }

      const def = await workflowModule.createDefinition(bodyResult.data, principal.id);
      res.status(201).json(def);
    }),
  );

  // List definitions for a document
  router.get(
    '/',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const queryResult = z.object({ documentId: z.string().min(1) }).safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({ error: 'documentId query parameter required' });
        return;
      }
      const { documentId } = queryResult.data;
      const principal = req.principal!;

      const allowed = await permissions.checkPermission(principal.id, documentId, 'read');
      if (!allowed) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Requires read permission' });
        return;
      }

      const defs = await workflowModule.listDefinitions(documentId);
      res.json(defs);
    }),
  );

  // Get single definition
  router.get(
    '/:id',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const def = await workflowModule.getDefinition(String(req.params.id));
      if (!def) {
        res.status(404).json({ error: 'Workflow definition not found' });
        return;
      }
      const allowed = await permissions.checkPermission(req.principal!.id, def.documentId, 'read');
      if (!allowed) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Requires read permission' });
        return;
      }
      res.json(def);
    }),
  );

  // Update definition
  router.patch(
    '/:id',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const bodyResult = UpdateWorkflowSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
        return;
      }
      const existing = await workflowModule.getDefinition(String(req.params.id));
      if (!existing) {
        res.status(404).json({ error: 'Workflow definition not found' });
        return;
      }
      const allowed = await permissions.checkPermission(
        req.principal!.id, existing.documentId, 'manage',
      );
      if (!allowed) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Requires manage permission' });
        return;
      }
      const updated = await workflowModule.updateDefinition(String(req.params.id), bodyResult.data);
      res.json(updated);
    }),
  );

  // Delete definition
  router.delete(
    '/:id',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const existing = await workflowModule.getDefinition(String(req.params.id));
      if (!existing) {
        res.status(404).json({ error: 'Workflow definition not found' });
        return;
      }
      const allowed = await permissions.checkPermission(
        req.principal!.id, existing.documentId, 'manage',
      );
      if (!allowed) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Requires manage permission' });
        return;
      }
      await workflowModule.deleteDefinition(String(req.params.id));
      res.json({ ok: true });
    }),
  );

  // List executions for a workflow
  router.get(
    '/:id/executions',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const existing = await workflowModule.getDefinition(String(req.params.id));
      if (!existing) {
        res.status(404).json({ error: 'Workflow definition not found' });
        return;
      }
      const allowed = await permissions.checkPermission(
        req.principal!.id, existing.documentId, 'read',
      );
      if (!allowed) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Requires read permission' });
        return;
      }
      const limitParam = Number(req.query.limit) || 50;
      const executions = await workflowModule.listExecutions(String(req.params.id), limitParam);
      res.json(executions);
    }),
  );

  // Get execution step logs
  router.get(
    '/:id/executions/:executionId/steps',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const existing = await workflowModule.getDefinition(String(req.params.id));
      if (!existing) {
        res.status(404).json({ error: 'Workflow definition not found' });
        return;
      }
      const allowed = await permissions.checkPermission(
        req.principal!.id, existing.documentId, 'read',
      );
      if (!allowed) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Requires read permission' });
        return;
      }
      const steps = await workflowModule.getExecutionLog(String(req.params.executionId));
      res.json(steps);
    }),
  );

  return router;
}
