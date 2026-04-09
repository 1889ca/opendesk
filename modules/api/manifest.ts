/** Contract: contracts/api/rules.md */

import type { OpenDeskManifest } from '../core/manifest/contract.ts';
import { createAdminRoutes } from './internal/admin-routes.ts';
import { createUploadRoutes } from './internal/upload-routes.ts';
import { createFileRoutes } from './internal/file-routes.ts';

/**
 * API module manifest.
 *
 * Owns the api-layer routes that have no natural home in a domain
 * module — admin (user data purge per `contracts/api/admin.md`),
 * upload (S3 image ingestion per `contracts/api/uploads.md`), and
 * file serving. These three are tightly coupled to api/internal
 * infrastructure (s3-client, redis cache, image-magic) and
 * shouldn't be rehomed; instead the api module participates in the
 * registry like every domain module.
 *
 * Mounts:
 *   /api/admin    — admin/admin.md (user data purge)
 *   /api          — uploads/uploads.md (POST /api/upload, GET /api/files/*)
 *
 * Two factories share the `/api` mount path; explicit `order`
 * keeps upload (POST /upload) ahead of file (GET /files/*) for
 * consistency, though Express would match either way since their
 * verbs and sub-paths don't collide.
 */
export const manifest: OpenDeskManifest = {
  name: 'api',
  contract: 'contracts/api/rules.md',
  apiRoutes: [
    {
      mount: '/api/admin',
      order: 10,
      factory: (ctx) =>
        createAdminRoutes({
          permissions: ctx.permissions,
          cache: ctx.redisClient,
        }),
    },
    {
      mount: '/api',
      order: 20,
      factory: (ctx) => createUploadRoutes({ permissions: ctx.permissions }),
    },
    {
      mount: '/api',
      order: 30,
      factory: (ctx) => createFileRoutes({ permissions: ctx.permissions }),
    },
  ],
};
