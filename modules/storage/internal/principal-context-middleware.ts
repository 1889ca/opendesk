/** Contract: contracts/storage/rules.md */

import type { Request, Response, NextFunction } from 'express';
import { runWithPrincipal } from './principal-context.ts';

/**
 * Express middleware that enters AsyncLocalStorage with the
 * authenticated principal so {@link rlsQuery} can issue
 * `SET LOCAL app.principal_id` per query (issue #126).
 *
 * Mount AFTER the auth middleware on the same path (`/api`).
 *
 * Behavior:
 *
 * - If `req.principal` is set (authenticated request), runs the
 *   downstream chain inside `runWithPrincipal(req.principal.id, ...)`.
 *   All grant/share_link queries during this request will be filtered
 *   by the user's RLS rules.
 *
 * - If `req.principal` is NOT set (public path or anonymous route),
 *   the middleware just calls `next()` with no context. Routes that
 *   legitimately need DB access without an authenticated principal
 *   (e.g. anonymous share-link resolution) must wrap their handler
 *   body in `runAsSystem(...)` explicitly. rlsQuery throws if called
 *   outside any context, so accidentally-permissive lookups become
 *   loud test failures rather than silent data leaks.
 */
export function principalContextMiddleware() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.principal?.id) {
      runWithPrincipal(req.principal.id, () => {
        next();
      });
      return;
    }
    next();
  };
}
