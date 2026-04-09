/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from './async-handler.ts';
import { listVersions as listEntryVersions, getVersion as getEntryVersion } from '../../kb/internal/pg-versions.ts';
import { resolveReference, parseKbUri } from '../../kb/internal/resolve-ref.ts';

const ResolveBody = z.object({
  uri: z.string().optional(),
  entryId: z.string().uuid().optional(),
  version: z.union([z.literal('latest'), z.number().int().positive()]).optional(),
}).refine(
  (d) => d.uri || (d.entryId && d.version !== undefined),
  { message: 'Provide either uri or both entryId and version' },
);

export type KbVersionRoutesOptions = {
  permissions: PermissionsModule;
};

/**
 * Mount KB version history + resolution routes.
 * Mounted under /api/kb/:id/versions and /api/kb/resolve.
 */
export function createKbVersionRoutes(opts: KbVersionRoutesOptions): Router {
  const { permissions } = opts;
  const router = Router({ mergeParams: true });

  // List versions for a KB entry
  router.get('/:id/versions', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const versions = await listEntryVersions(String(req.params.id));
    res.json(versions);
  }));

  // Get a specific version
  router.get('/:id/versions/:version', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const version = parseInt(String(req.params.version), 10);
    if (isNaN(version) || version < 1) {
      res.status(400).json({ error: 'Invalid version number' });
      return;
    }
    const ver = await getEntryVersion(String(req.params.id), version);
    if (!ver) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }
    res.json(ver);
  }));

  // Resolve a kb:// reference (or entryId + version pair)
  router.post('/resolve', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const bodyResult = ResolveBody.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
      return;
    }

    const { uri, entryId, version } = bodyResult.data;
    let ref;

    if (uri) {
      ref = parseKbUri(uri);
      if (!ref) {
        res.status(400).json({ error: 'Invalid kb:// URI format' });
        return;
      }
    } else {
      ref = { entryId: entryId!, version: version! };
    }

    const result = await resolveReference(ref);
    if (!result.ok) {
      const status = result.code === 'ENTRY_NOT_FOUND' || result.code === 'VERSION_NOT_FOUND' ? 404 : 422;
      res.status(status).json({ error: result.message, code: result.code });
      return;
    }

    res.json(result.data);
  }));

  return router;
}
