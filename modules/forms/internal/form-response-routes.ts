/** Contract: contracts/forms/rules.md */

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import { EventType, type EventBusModule } from '../../events/contract.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';
import { createPgFormStore } from './pg-store.ts';
import { validateResponse } from './validate-response.ts';

const store = createPgFormStore();

const SubmitResponseBody = z.object({
  answers: z.record(z.unknown()),
});

export interface FormResponseRoutesOptions {
  permissions: PermissionsModule;
  eventBus: EventBusModule;
}

/**
 * Response sub-routes for forms.
 * Mounted at /api/forms/:id/responses via an Express param-matching router.
 * Note: Express does not support mergeParams automatically when mounting
 * a sub-router at a parameterised path — the parent router passes :id
 * as a query string alternative via the formId param below.
 *
 * Actual mounting: form-routes.ts mounts these handlers directly using
 * router.post/get('/:id/responses', ...) rather than a sub-router so
 * the :id param is visible.
 */
export function createFormResponseHandlers(opts: FormResponseRoutesOptions) {
  const { permissions, eventBus } = opts;

  // POST /:id/responses — submit a response (public, no auth required)
  const submit = asyncHandler(async (req: Request, res: Response) => {
    const form = await store.getDefinition(String(req.params.id));
    if (!form) {
      res.status(404).json({ error: 'Form not found' });
      return;
    }

    const isClosed = form.close_at !== null && new Date(form.close_at).getTime() <= Date.now();
    if (isClosed) {
      res.status(410).json({ error: 'This form is closed and no longer accepting responses.' });
      return;
    }

    const body = SubmitResponseBody.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: 'Validation failed', issues: body.error.issues });
      return;
    }

    // Server-side required/type validation — contract invariant 2
    const validation = validateResponse(form, body.data.answers as Record<string, unknown>);
    if (!validation.ok) {
      res.status(400).json({ error: 'Response validation failed', fieldErrors: validation.errors });
      return;
    }

    const principal = req.principal ?? null;

    // Reject anonymous submission if form requires auth — contract invariant 3
    if (!form.anonymous && !principal) {
      res.status(401).json({ error: 'This form requires authentication to submit.' });
      return;
    }

    try {
      const response = await store.submitResponse({
        form_id: form.id,
        definition_version: form.version,
        principal_id: principal?.id ?? null,
        answers: body.data.answers,
      });

      await eventBus.emit({
        id: randomUUID(),
        type: EventType.FormSubmitted,
        aggregateId: form.id,
        actorId: principal?.id ?? 'anonymous',
        actorType: principal ? 'human' : 'system',
        occurredAt: new Date().toISOString(),
      }, null);

      res.status(201).json(response);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === 'FORM_CLOSED') {
        res.status(410).json({ error: 'This form is closed.' });
        return;
      }
      throw err;
    }
  });

  // GET /:id/responses — list responses (auth, owner only)
  const list = [
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const form = await store.getDefinition(String(req.params.id));
      if (!form) {
        res.status(404).json({ error: 'Form not found' });
        return;
      }

      const limitRaw = Number(req.query.limit ?? 100);
      const offsetRaw = Number(req.query.offset ?? 0);
      const limit = Number.isFinite(limitRaw) ? Math.min(limitRaw, 500) : 100;
      const offset = Number.isFinite(offsetRaw) ? offsetRaw : 0;

      const responses = await store.listResponses(form.id, limit, offset);
      res.json({ form_id: form.id, limit, offset, data: responses });
    }),
  ] as const;

  return { submit, list };
}

/** Mount response sub-routes onto a router at /:id/responses. */
export function mountResponseRoutes(router: Router, opts: FormResponseRoutesOptions): void {
  const { submit, list } = createFormResponseHandlers(opts);
  router.post('/:id/responses', submit);
  router.get('/:id/responses', ...list);
}
