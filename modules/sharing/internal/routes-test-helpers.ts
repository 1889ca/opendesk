/** Contract: contracts/sharing/rules.md */

import express, { type Request, type Response, type NextFunction } from 'express';
import { createShareRoutes } from './routes.ts';
import { createShareLinkService, type ShareLinkService } from './share-links.ts';
import { type ShareLinkStore } from './store.ts';
import { createPermissions } from '../../permissions/index.ts';
import { createInMemoryPasswordRateLimiter } from './rate-limit.ts';

/** Middleware that simulates auth by attaching a fake principal. */
export function fakePrincipal(id = 'user-1') {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.principal = { id, actorType: 'human', displayName: 'Test', scopes: [] };
    next();
  };
}

export function createTestApp(store: ShareLinkStore, principalId = 'user-1') {
  const app = express();
  app.use(express.json());
  const permissions = createPermissions();

  // Grant owner role on doc-1 to the default test user
  permissions.grantStore.create({
    principalId,
    resourceId: 'doc-1',
    resourceType: 'document',
    role: 'owner',
    grantedBy: principalId,
  });

  app.use(fakePrincipal(principalId));
  const service: ShareLinkService = createShareLinkService(store);
  app.use(createShareRoutes({
    service,
    grantStore: permissions.grantStore,
    permissions,
    rateLimiter: createInMemoryPasswordRateLimiter(),
  }));
  return { app, permissions, service };
}
