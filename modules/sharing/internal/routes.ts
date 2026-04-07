/** Contract: contracts/sharing/rules.md */

import { Router } from 'express';
import { GrantRoleSchema, ShareLinkOptionsSchema } from '../contract.ts';
import type { ShareLinkService } from './share-links.ts';
import type { GrantStore, Role } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/index.ts';

export type ShareRouteDeps = {
  grantStore?: GrantStore;
};

/**
 * Create Express routes for share link management.
 * Mounts on the parent router; does not create its own app.
 */
export function createShareRoutes(service: ShareLinkService, deps?: ShareRouteDeps): Router {
  const router = Router();

  /** POST /api/documents/:id/share -- create a share link */
  router.post('/api/documents/:id/share', asyncHandler(async (req, res) => {
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

    const grantorId = req.principal?.id ?? 'anonymous';

    const link = await service.create({
      docId: String(docId),
      grantorId,
      role: roleResult.data,
      options: optsParse.data,
    });

    // Never expose passwordHash to the client
    const { passwordHash: _, ...safeLink } = link;
    res.status(201).json(safeLink);
  }));

  /** POST /api/share/:token/resolve -- resolve (redeem) a share link */
  router.post('/api/share/:token/resolve', asyncHandler(async (req, res) => {
    const token = String(req.params.token);
    const password = req.body?.password as string | undefined;
    const result = await service.resolve(token, password);

    if (!result.ok) {
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

    // Persist a Grant so the redeemer gets lasting access
    const granteeId = req.principal?.id;
    if (granteeId && deps?.grantStore) {
      await deps.grantStore.create({
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

  /** DELETE /api/share/:token -- revoke a share link */
  router.delete('/api/share/:token', asyncHandler(async (req, res) => {
    const revoked = await service.revoke(String(req.params.token));
    if (!revoked) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ ok: true });
  }));

  return router;
}
