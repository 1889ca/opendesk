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
import type { PasswordRateLimiter } from '../../sharing/internal/rate-limit.ts';
import { createConvertRoutes } from './convert-routes.ts';
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
import { createShareRoutes } from '../../sharing/index.ts';
import { createAuditRoutes } from '../../audit/index.ts';
import { createWorkflowRoutes, createPluginRoutes } from '../../workflow/index.ts';
import { createMetricsRoutes, createTelemetryMiddleware } from '../../observability/index.ts';
import { createAiRoutes, createAi } from '../../ai/index.ts';
import { createErasure, createErasureRoutes } from '../../erasure/index.ts';
import { createFederation, createFederationRoutes } from '../../federation/index.ts';
import { idempotencyMiddleware } from './idempotency.ts';
import { pool, principalContextMiddleware } from '../../storage/index.ts';
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
  publicDir: string;
}

/**
 * Mount all API routes onto the Express app.
 * Returns the AI module reference (if started) for shutdown coordination.
 */
export function mountRoutes(deps: RouteDependencies): { ai: ReturnType<typeof createAi> | null } {
  const {
    app, auth, permissions, hocuspocus, redisClient,
    config, eventBus, audit, workflow, observability,
    shareLinkService, shareRateLimiter, publicDir,
  } = deps;

  app.use(express.json({ limit: '100kb' }));

  // Idempotency middleware for mutating endpoints (POST, PUT, DELETE)
  app.use('/api', idempotencyMiddleware({
    cache: redisClient,
    exemptPaths: ['/share/'],
  }));

  // Serve static frontend
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

  // BibTeX/RIS text body parser — after auth, before reference routes
  app.use(express.text({ type: ['application/x-bibtex', 'application/x-ris'] }));

  // Collabora convert routes (import/export binary formats) — after auth
  app.use(createConvertRoutes({ permissions }));

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

  // KB entry routes (generalized knowledge base entries + relationships)
  app.use('/api/kb/entries', createKBEntryRoutes({ permissions }));

  // KB dataset row routes (nested under entries)
  app.use('/api/kb/entries/:entryId/rows', createKBDatasetRoutes({ permissions }));

  // KB snapshot routes (immutable entry-version captures)
  app.use('/api/kb/snapshots', createKBSnapshotRoutes({ permissions }));

  // KB entity directory routes
  app.use('/api/kb/entities', createEntityRoutes({ permissions }));

  // Audit routes (crypto audit log + chain verification)
  app.use('/api/audit', createAuditRoutes({
    permissions,
    auditModule: audit,
    pool,
    hmacSecret: config.audit.hmacSecret,
  }));

  // Workflow routes (trigger/action CRUD + execution history)
  app.use('/api/workflows', createWorkflowRoutes({ permissions, workflowModule: workflow }));

  // Wasm plugin routes (plugin registry for sandboxed integrations)
  app.use('/api/workflows/plugins', createPluginRoutes({ permissions, pool }));

  // Admin routes (user data purge)
  app.use('/api/admin', createAdminRoutes({ permissions, cache: redisClient }));

  // Observability metrics routes
  app.use('/api/admin/metrics', createMetricsRoutes({ observability, permissions, pool }));

  // Erasure routes (verifiable data erasure, retention policies)
  const erasure = createErasure({ pool });
  app.use('/api/erasure', createErasureRoutes({ erasure, permissions }));

  // Federation routes (peer management, document exchange) — gated by config
  if (config.federation.enabled) {
    const federation = createFederation({
      pool,
      config: config.federation,
      hmacSecret: config.audit.hmacSecret,
    });
    app.use('/api/federation', createFederationRoutes({ federation, permissions }));
  }

  // AI routes (semantic search, RAG assistant, embedding) — gated by config
  let ai: ReturnType<typeof createAi> | null = null;
  if (config.ai.enabled) {
    ai = createAi({ pool, config: config.ai, eventBus });
    ai.startConsumer();
    app.use('/api/ai', createAiRoutes({ ai, permissions }));
  }

  // Share link routes (create, resolve, revoke) — after auth
  app.use(createShareRoutes({
    service: shareLinkService,
    grantStore: permissions.grantStore,
    permissions,
    rateLimiter: shareRateLimiter,
  }));

  // File upload and serving routes — after auth, with permission checks
  app.use('/api', createUploadRoutes({ permissions }));
  app.use('/api', createFileRoutes({ permissions }));

  return { ai };
}
