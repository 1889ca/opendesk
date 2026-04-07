/** Contract: contracts/permissions/rules.md */

import type { Request, Response, NextFunction } from 'express';
import { evaluate, type Action } from '../contract.ts';
import type { GrantStore } from './grant-store.ts';
import { loadConfig } from '../../config/index.ts';

export type PermissionMiddlewareOptions = {
  grantStore: GrantStore;
  /** Extract the resourceId from the request. Defaults to req.params.id. */
  getResourceId?: (req: Request) => string | undefined;
  /** Resource type for permission queries. Defaults to 'document'. */
  resourceType?: string;
};

/**
 * Creates Express middleware that checks whether the authenticated principal
 * has permission to perform the given action on the resource.
 *
 * Requires auth middleware to have already populated req.principal.
 * Returns 401 if no principal, 403 if permission denied.
 */
export function requirePermission(action: Action, opts: PermissionMiddlewareOptions) {
  const resourceType = opts.resourceType ?? 'document';
  const getResourceId = opts.getResourceId ?? ((req: Request) => {
    const id = req.params.id;
    return Array.isArray(id) ? id[0] : id;
  });

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const principal = req.principal;
    if (!principal) {
      res.status(401).json({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      });
      return;
    }

    // In dev mode, skip permission checks (no grants exist for dev users)
    if (loadConfig().auth.mode === 'dev') {
      next();
      return;
    }


    const resourceId = getResourceId(req);
    if (!resourceId) {
      res.status(400).json({
        code: 'MISSING_RESOURCE_ID',
        message: 'Resource identifier is required',
      });
      return;
    }

    const grants = await opts.grantStore.findByPrincipalAndResource(
      principal.id,
      resourceId,
      resourceType,
    );

    const result = evaluate(principal, grants, {
      principalId: principal.id,
      action,
      resourceId,
      resourceType,
    });

    if (!result.allowed) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: result.reason,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware that only checks authentication (principal exists).
 * Used for endpoints like document creation where no resource-level
 * permission check is needed (the resource doesn't exist yet).
 */
export function requireAuth() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.principal) {
      res.status(401).json({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      });
      return;
    }
    next();
  };
}
