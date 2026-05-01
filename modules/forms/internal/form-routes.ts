/** Contract: contracts/forms/rules.md */

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import type { AuditModule } from '../../audit/contract.ts';
import { EventType, type EventBusModule } from '../../events/contract.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';
import { pool } from '../../storage/internal/pool.ts';
import { QuestionSchema } from '../contract.ts';
import { createPgFormStore } from './pg-store.ts';
import { mountResponseRoutes } from './form-response-routes.ts';

const store = createPgFormStore();
const MAX_QUESTIONS = 250;
const DEFAULT_WORKSPACE = '00000000-0000-0000-0000-000000000000';

const CreateFormBody = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  questions: z.array(QuestionSchema).max(MAX_QUESTIONS).default([]),
  anonymous: z.boolean().default(false),
  single_response: z.boolean().default(false),
  close_at: z.string().nullable().optional(),
});

const UpdateFormBody = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  questions: z.array(QuestionSchema).max(MAX_QUESTIONS).optional(),
  anonymous: z.boolean().optional(),
  single_response: z.boolean().optional(),
  close_at: z.string().nullable().optional(),
  closed: z.boolean().optional(),
});

interface FormListRow {
  id: string;
  title: string;
  version: number;
  anonymous: boolean;
  single_response: boolean;
  close_at: Date | null;
  closed: boolean;
  schema: unknown;
  updated_at: Date;
}

export interface FormRoutesOptions {
  permissions: PermissionsModule;
  audit: AuditModule;
  eventBus: EventBusModule;
}

export function createFormRoutes(opts: FormRoutesOptions): Router {
  const { permissions, audit, eventBus } = opts;
  const router = Router();

  // GET /api/forms — list forms owned by the authenticated user
  router.get('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const principal = req.principal!;
    const result = await pool.query<FormListRow>(
      `SELECT id, title, version, anonymous, single_response, close_at, closed, schema, updated_at
       FROM forms WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT 200`,
      [principal.id],
    );
    const forms = result.rows.map((row) => {
      const schema = row.schema as Record<string, unknown>;
      return {
        id: row.id, title: row.title, version: row.version,
        anonymous: row.anonymous, single_response: row.single_response,
        close_at: row.close_at ? row.close_at.toISOString() : null,
        closed: row.closed, questions: schema.questions ?? [],
        description: schema.description,
        updated_at: row.updated_at.toISOString(),
      };
    });
    res.json(forms);
  }));

  // POST /api/forms — create a form
  router.post('/', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const body = CreateFormBody.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: 'Validation failed', issues: body.error.issues });
      return;
    }
    const principal = req.principal!;
    const form = await store.createDefinition({
      id: `frm_${randomUUID()}`,
      workspace_id: DEFAULT_WORKSPACE,
      owner_id: principal.id,
      version: 1,
      title: body.data.title,
      description: body.data.description,
      questions: body.data.questions,
      anonymous: body.data.anonymous,
      single_response: body.data.single_response,
      close_at: body.data.close_at ?? null,
    } as Parameters<typeof store.createDefinition>[0] & { owner_id: string });

    const event = {
      id: randomUUID(), type: EventType.FormSubmitted,
      aggregateId: form.id, actorId: principal.id,
      actorType: 'human' as const, occurredAt: new Date().toISOString(),
    };
    await eventBus.emit(event, null);
    await audit.recordEvent(event);
    res.status(201).json(form);
  }));

  // GET /api/forms/:id — get form definition (public)
  router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const form = await store.getDefinition(String(req.params.id));
    if (!form) { res.status(404).json({ error: 'Form not found' }); return; }
    res.json(form);
  }));

  // PUT /api/forms/:id — update form schema
  router.put('/:id', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const body = UpdateFormBody.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: 'Validation failed', issues: body.error.issues });
      return;
    }
    const form = await store.getDefinition(String(req.params.id));
    if (!form) { res.status(404).json({ error: 'Form not found' }); return; }

    const principal = req.principal!;
    const { closed, ...patch } = body.data;
    if (closed) await store.closeForm(form.id);
    const updated = await store.updateDefinition(form.id, patch);

    await audit.recordEvent({
      id: randomUUID(), type: EventType.FormSubmitted,
      aggregateId: form.id, actorId: principal.id,
      actorType: 'human' as const, occurredAt: new Date().toISOString(),
    });
    res.json(updated);
  }));

  // DELETE /api/forms/:id — delete form (cascades to responses)
  router.delete('/:id', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const form = await store.getDefinition(String(req.params.id));
    if (!form) { res.status(404).json({ error: 'Form not found' }); return; }

    await pool.query('DELETE FROM forms WHERE id = $1', [form.id]);
    const principal = req.principal!;
    await audit.recordEvent({
      id: randomUUID(), type: EventType.FormSubmitted,
      aggregateId: form.id, actorId: principal.id,
      actorType: 'human' as const, occurredAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  }));

  // POST /api/forms/:id/responses and GET /api/forms/:id/responses
  // delegated to form-response-routes.ts
  mountResponseRoutes(router, { permissions, eventBus });

  return router;
}
