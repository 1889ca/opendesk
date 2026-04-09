/** Contract: contracts/api/rules.md */
import express, { type Express } from 'express';
import type { AuthModule } from '../../auth/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import type { Hocuspocus } from '@hocuspocus/server';
import type { CacheClient } from './redis.ts';
import type { AuditModule } from '../../audit/contract.ts';
import type { WorkflowModule } from '../../workflow/contract.ts';
import type { ObservabilityModule } from '../../observability/contract.ts';
import type { ShareLinkService } from '../../sharing/internal/share-links.ts';
import type { PasswordRateLimiter, ShareResolveRateLimiter } from '../../sharing/internal/rate-limit.ts';
import { createDocumentRoutes } from './document-routes.ts';
import { createExportRoutes } from './export-routes.ts';
import { createAdminRoutes } from './admin-routes.ts';
import { createUploadRoutes } from './upload-routes.ts';
import { createFileRoutes } from './file-routes.ts';
import { createTemplateRoutes } from './template-routes.ts';
import { createVersionRoutes } from './version-routes.ts';
import { createFolderRoutes, createMoveDocumentRoute } from './folder-routes.ts';
import { createSearchRoutes } from './search-routes.ts';
import { createReferenceRoutes } from './reference-routes.ts';
import { createImportExportRoutes } from './reference-import-routes.ts';
import { createEntityRoutes } from './entity-routes.ts';
import { createKBEntryRoutes } from './kb-entry-routes.ts';
import { createKBDatasetRoutes } from './kb-dataset-routes.ts';
import { createKBSnapshotRoutes } from './kb-snapshot-routes.ts';
import { createKbRoutes } from './kb-routes.ts';
import { createKbVersionRoutes } from './kb-version-routes.ts';
import { createShareRoutes } from '../../sharing/index.ts';
import { createMetricsRoutes, createTelemetryMiddleware } from '../../observability/index.ts';
import {
  manifests,
  filterEnabled,
  mountManifestRoutes,
  runManifestStartHooks,
  runManifestShutdownHooks,
  createServiceRegistry,
  type AppContext,
} from '../../core/manifest/index.ts';
import { idempotencyMiddleware } from './idempotency.ts';
import { serveHtmlWithNonce } from './csp-nonce.ts';
import { principalContextMiddleware } from '../../storage/index.ts';
// Composition root: pool comes from storage/internal/pool.ts since
// the public storage surface no longer re-exports it (#134).
import { pool } from '../../storage/internal/pool.ts';
import type { AppConfig } from '../../config/contract.ts';
import type { EventBusModule } from '../../events/contract.ts';

export interface RouteDependencies {
  app: Express;
  auth: AuthModule;
  permissions: PermissionsModule;
  hocuspocus: Hocuspocus;
  redisClient: CacheClient;
  config: AppConfig;
  eventBus: EventBusModule;
  audit: AuditModule;
  workflow: WorkflowModule;
  observability: ObservabilityModule;
  shareLinkService: ShareLinkService;
  shareRateLimiter: PasswordRateLimiter;
  shareResolveRateLimiter: ShareResolveRateLimiter;
  publicDir: string;
}

/**
 * Mount all API routes onto the Express app and run lifecycle
 * start hooks for every enabled manifest. Returns a `shutdown`
 * closure that the composition root must call during graceful
 * teardown so each manifest's `onShutdown` runs in reverse order.
 *
 * Async because manifest `onStart` hooks may be async (e.g. an
 * AI consumer that opens a connection during startup).
 */
export async function mountRoutes(deps: RouteDependencies): Promise<{ shutdown: () => Promise<void> }> {
  const {
    app, auth, permissions, hocuspocus, redisClient,
    config, eventBus, audit, workflow, observability,
    shareLinkService, shareRateLimiter, shareResolveRateLimiter, publicDir,
  } = deps;

  app.use(express.json({ limit: '100kb' }));

  // Idempotency middleware for mutating endpoints (POST, PUT, DELETE)
  app.use('/api', idempotencyMiddleware({
    cache: redisClient,
    exemptPaths: ['/share/'],
  }));

  // Serve HTML with CSP nonces injected (L11), then static assets
  app.use(serveHtmlWithNonce(publicDir));
  app.use(express.static(publicDir));

  // Auth middleware on all /api routes (except public paths)
  app.use('/api', auth.middleware);

  // Principal-context middleware (issue #126): runs the rest of the
  // request inside AsyncLocalStorage so rlsQuery can issue the
  // SET LOCAL app.principal_id needed for the grants/share_links
  // RLS policies. Must run after auth (req.principal must be set).
  app.use('/api', principalContextMiddleware());

  // Telemetry middleware — after auth so we have principal info
  if (config.observability.enabled) {
    app.use(createTelemetryMiddleware(observability, config.observability.sampleRate));
  }

  // BibTeX/RIS text body parser — after auth, before reference routes.
  // Explicit 1 MB cap so a giant body can't exhaust memory before the
  // route handler runs (review-2026-04-08 MED-4). The route also caps
  // the parsed entry count.
  app.use(express.text({
    type: ['application/x-bibtex', 'application/x-ris'],
    limit: '1mb',
  }));

  // Health check (public, skipped by auth middleware)
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unhealthy' });
    }
  });

  // Search must be mounted before document CRUD so /search is matched before /:id
  const authMode = config.auth.mode;
  app.use('/api/documents', createSearchRoutes({ permissions }));
  app.use('/api/documents', createDocumentRoutes({ permissions, cache: redisClient }));
  app.use('/api/documents/:id/versions', createVersionRoutes({ permissions, hocuspocus }));
  app.use('/api/documents', createMoveDocumentRoute({ permissions }));
  app.use('/api/folders', createFolderRoutes({ permissions }));
  app.use('/api/documents', createExportRoutes({ permissions }));
  app.use('/api/templates', createTemplateRoutes({ permissions, authMode }));
  app.use('/api/references', createReferenceRoutes({ permissions }));
  app.use('/api/references', createImportExportRoutes({ permissions }));

  // KB browser routes (CRUD + lifecycle — used by kb.html)
  app.use('/api/kb', createKbRoutes({ permissions }));
  app.use('/api/kb', createKbVersionRoutes({ permissions }));

  // KB entry routes (generalized knowledge base entries + relationships)
  app.use('/api/kb/entries', createKBEntryRoutes({ permissions }));

  // KB dataset row routes (nested under entries)
  app.use('/api/kb/entries/:entryId/rows', createKBDatasetRoutes({ permissions }));

  // KB snapshot routes (immutable entry-version captures)
  app.use('/api/kb/snapshots', createKBSnapshotRoutes({ permissions }));

  // KB entity directory routes
  app.use('/api/kb/entities', createEntityRoutes({ permissions }));

  // Manifest-driven routes: every module that has been migrated to
  // modules/<name>/manifest.ts is mounted here in one shot. The
  // composition root no longer hard-codes per-module imports for
  // the migrated set; see modules/core/manifest/registry.ts for the
  // canonical list. Restricted-zone modules (auth/sharing/permissions
  // per CONSTITUTION.md) are deliberately still hand-mounted below.
  //
  // Order matters: runManifestStartHooks must run BEFORE
  // mountManifestRoutes so that lifecycle hooks (e.g. ai's onStart
  // creating its consumer) can register handles into the service
  // registry before any route factory tries to read them.
  const ctx: AppContext = {
    app, config, pool,
    auth, permissions, hocuspocus, redisClient,
    eventBus, audit, workflow, observability,
    shareLinkService, shareRateLimiter, shareResolveRateLimiter, publicDir,
    ...createServiceRegistry(),
  };
  const enabledManifests = filterEnabled(manifests, ctx);
  const manifestHandles = await runManifestStartHooks(ctx, enabledManifests);
  mountManifestRoutes(ctx, enabledManifests);

  // Admin routes (user data purge)
  app.use('/api/admin', createAdminRoutes({ permissions, cache: redisClient }));

  // Observability metrics routes
  app.use('/api/admin/metrics', createMetricsRoutes({ observability, permissions, pool }));

  // Share link routes (create, resolve, revoke) — after auth
  app.use(createShareRoutes({
    service: shareLinkService,
    grantStore: permissions.grantStore,
    permissions,
    rateLimiter: shareRateLimiter,
    resolveRateLimiter: shareResolveRateLimiter,
  }));

  // File upload and serving routes — after auth, with permission checks
  app.use('/api', createUploadRoutes({ permissions }));
  app.use('/api', createFileRoutes({ permissions }));

  return {
    shutdown: () => runManifestShutdownHooks(ctx, manifestHandles),
  };
}
