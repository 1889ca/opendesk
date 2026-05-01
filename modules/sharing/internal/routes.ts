/** Contract: contracts/sharing/rules.md */

import { Router } from 'express';
import { GrantRoleSchema, ShareLinkOptionsSchema } from '../contract.ts';
import type { ShareLinkService } from './share-links.ts';
import type { GrantStore, Role, PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';
import { runAsSystem } from '../../storage/index.ts';
import type { PasswordRateLimiter, ShareResolveRateLimiter } from './rate-limit.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('sharing:routes');

export type ShareRoutesOptions = {
  service: ShareLinkService;
  grantStore?: GrantStore;
  permissions: PermissionsModule;
  /** Per-token password attempt limiter (existing behavior). */
  rateLimiter: PasswordRateLimiter;
  /**
   * Per-IP resolve attempt limiter (issue #135). The password
   * limiter is keyed by token, so token enumeration bypasses it.
   * This second limiter caps total resolve attempts per source IP.
   * Optional for backward compatibility — when omitted, only the
   * password limiter applies.
   */
  resolveRateLimiter?: ShareResolveRateLimiter;
};

/**
 * Create Express routes for share link management.
 * Mounts on the parent router; does not create its own app.
 */
export function createShareRoutes(opts: ShareRoutesOptions): Router {
  const { service, grantStore, permissions, rateLimiter, resolveRateLimiter } = opts;
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

      const { link, wireToken } = await service.create({
        docId: String(docId),
        grantorId,
        role: roleResult.data,
        options: optsParse.data,
      });

      // Never expose passwordHash to the client.
      // Expose wireToken as the shareable token (may be signed or legacy jti).
      const { passwordHash: _, token: _jti, ...rest } = link;
      res.status(201).json({ ...rest, token: wireToken });
    }),
  );

  /**
   * POST /api/share/:token/resolve -- resolve (redeem) a share link.
   *
   * Wrapped in runAsSystem because the share-link token IS the access
   * credential (issue #126). Without this wrapper, store.findByToken
   * would fail for anonymous traffic since it now uses rls-query and
   * needs an explicit principal context. The grant insert at the end
   * also runs as system; the granted_by field carries the original
   * grantor's id, not the system sentinel.
   */
  router.post('/api/share/:token/resolve', asyncHandler(async (req, res) => {
    // Issue #135: rate-limit anonymous resolve attempts by source IP
    // BEFORE any other work. Token enumeration (random tokens) bypasses
    // the per-token password limiter because each guess is a different
    // key; this per-IP cap slows blind enumeration.
    //
    // review-2026-04-08 MED-3: use consume() (atomic INCR-then-check)
    // instead of the previous check-then-record pair, which had a
    // TOCTOU race that let concurrent requests overshoot the limit.
    if (resolveRateLimiter) {
      const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
      const allowed = await resolveRateLimiter.consume(ip);
      if (!allowed) {
        res.status(429).json({ error: 'too_many_attempts', retryAfterSeconds: 60 });
        return;
      }
    }

    await runAsSystem(async () => {
    const token = String(req.params.token);
    const password = req.body?.password as string | undefined;

    // Rate-limit password attempts per token. Same MED-3 fix:
    // consume() is atomic; check() alone races.
    if (password !== undefined) {
      const allowed = await rateLimiter.consume(token);
      if (!allowed) {
        res.status(429).json({ error: 'too_many_attempts', retryAfterSeconds: 60 });
        return;
      }
    }

    const isAuthenticated = !!req.principal?.id;
    const result = await service.resolve(token, password, {
      skipIncrement: !isAuthenticated,
    });

    if (!isAuthenticated && result.ok) {
      log.warn('anonymous share link resolution attempted', { token: token.slice(0, 8) + '...' });
    }

    if (!result.ok) {
      // Note: we no longer call rateLimiter.record() on wrong_password
      // because consume() above already incremented the counter when
      // the request was admitted. The previous code path
      // (check + record-on-failure) had a TOCTOU race; the new
      // consume() pattern counts every attempt, which is exactly
      // what we want for password brute force.

      const statusMap = {
        not_found: 404,
        expired: 410,
        revoked: 410,
        exhausted: 410,
        wrong_password: 403,
        invalid_token: 400,
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
    });
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
