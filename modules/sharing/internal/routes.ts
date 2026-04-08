/** Contract: contracts/sharing/rules.md */

import { Router } from 'express';
import { GrantRoleSchema, ShareLinkOptionsSchema } from '../contract.ts';
import type { ShareLinkService } from './share-links.ts';
import type { GrantStore, Role, PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';
import type { PasswordRateLimiter } from './rate-limit.ts';

export type ShareRoutesOptions = {
  service: ShareLinkService;
  grantStore?: GrantStore;
  permissions: PermissionsModule;
  rateLimiter: PasswordRateLimiter;
};

/**
 * Create Express routes for share link management.
 * Mounts on the parent router; does not create its own app.
 */
export function createShareRoutes(opts: ShareRoutesOptions): Router {
  const { service, grantStore, permissions, rateLimiter } = opts;
  const router = Router();

  /** POST /api/documents/:id/share -- create a share link (requires write permission) */
  router.post(
    '/api/documents/:id/share',
    permissions.require('write'),
    asyncHandler(async (req, res) => {
      const docId = req.params.id;
      const roleResult = GrantRoleSchema.safeParse(req.body?.role);
      if (!roleResult.success) {
        res.status(400).json({ error: 'role must be "viewer", "editor", or "commenter"' });
        return;
      }

      const optsParse = ShareLinkOptionsSchema.safeParse(req.body?.options ?? {});
      if (!optsParse.success) {
        res.status(400).json({ error: 'invalid options', details: optsParse.error.issues });
        return;
      }

      const grantorId = req.principal!.id;

      const link = await service.create({
        docId: String(docId),
        grantorId,
        role: roleResult.data,
        options: optsParse.data,
      });

      // Never expose passwordHash to the client
      const { passwordHash: _, ...safeLink } = link;
      res.status(201).json(safeLink);
    }),
  );

  /** POST /api/share/:token/resolve -- resolve (redeem) a share link */
  router.post('/api/share/:token/resolve', asyncHandler(async (req, res) => {
    const token = String(req.params.token);
    const password = req.body?.password as string | undefined;

    // Rate-limit password attempts per token
    if (password !== undefined) {
      const allowed = await rateLimiter.check(token);
      if (!allowed) {
        res.status(429).json({ error: 'too_many_attempts', retryAfterSeconds: 60 });
        return;
      }
    }

    const result = await service.resolve(token, password);

    if (!result.ok) {
      if (result.reason === 'wrong_password') {
        await rateLimiter.record(token);
      }

      const statusMap = {
        not_found: 404,
        expired: 410,
        revoked: 410,
        exhausted: 410,
        wrong_password: 403,
      } as const;
      res.status(statusMap[result.reason]).json({ error: result.reason });
      return;
    }

    // Successful resolution clears rate limit state for this token
    await rateLimiter.reset(token);

    // Persist a Grant so the redeemer gets lasting access
    const granteeId = req.principal?.id;
    if (granteeId && grantStore) {
      await grantStore.create({
        principalId: granteeId,
        resourceId: result.link.docId,
        resourceType: 'document',
        role: result.link.role as Role,
        grantedBy: result.link.grantorId,
      });
    }

    const { passwordHash: _, ...safeLink } = result.link;
    res.json({ grant: { docId: safeLink.docId, role: safeLink.role }, link: safeLink });
  }));

  /** DELETE /api/share/:token -- revoke a share link (creator or document write permission) */
  router.delete('/api/share/:token', permissions.requireAuth, asyncHandler(async (req, res) => {
    const principalId = req.principal!.id;
    const token = String(req.params.token);
    const link = await service.getByToken(token);
    if (!link) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // Only the link creator or someone with write permission on the doc can revoke
    if (link.grantorId !== principalId) {
      const hasWrite = await permissions.checkPermission(principalId, link.docId, 'write');
      if (!hasWrite) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
    }

    await service.revoke(token);
    res.json({ ok: true });
  }));

  return router;
}
