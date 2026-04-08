/** Contract: contracts/api/rules.md */
import { createServer } from 'node:http';
import express, { type Request, type Response, type NextFunction } from 'express';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCollabServer } from '../../collab/index.ts';
import { getRedisClient, disconnectRedis } from './redis.ts';
import { idempotencyMiddleware } from './idempotency.ts';
import { createConvertRoutes } from './convert-routes.ts';
import { createAuth } from '../../auth/index.ts';
import { createPermissions, createPgGrantStore } from '../../permissions/index.ts';
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
import { createShareLinkService, createPgShareLinkStore, createShareRoutes, createPasswordRateLimiter } from '../../sharing/index.ts';
import { pool, initSchema } from '../../storage/index.ts';
import { ensureS3Bucket } from './s3-client.ts'; import { applySecurityMiddleware } from './security.ts';
import { createEventBus } from '../../events/index.ts';
import { createAudit, createAuditRoutes } from '../../audit/index.ts';
import { createWorkflow, createWorkflowRoutes } from '../../workflow/index.ts';
import { createObservability, createTelemetryMiddleware, createMetricsRoutes } from '../../observability/index.ts';
import { createAi, createAiRoutes } from '../../ai/index.ts';
import { loadConfig } from '../../config/index.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('api');
const __dirname = dirname(fileURLToPath(import.meta.url));
export async function startServer(port = 3000) {
  try {
    await initSchema();
    log.info('database schema initialized');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('schema init failed — continuing anyway', { error: msg });
  }
  try {
    await ensureS3Bucket();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('S3 bucket init failed — uploads may fail', { error: msg });
  }
  const app = express();

  // Redis client needed for rate limiting + idempotency + caching
  const redisClient = getRedisClient();

  // Security middleware (CORS, helmet, rate limiting) — must be first
  applySecurityMiddleware(app, { redis: redisClient });

  // Wire auth module (dev mode uses bypass verifiers)
  const auth = createAuth({
    serviceAccountStore: { findByKeyHash: async () => null },
    serviceAccountStorage: {
      insertServiceAccount: async () => {},
      findServiceAccountById: async () => null,
      revokeServiceAccount: async () => {},
    },
    publicPaths: ['/health'],
  });

  // Wire collab server with auth dependency
  const { handleUpgrade, hocuspocus } = createCollabServer({
    tokenVerifier: auth.tokenVerifier,
  });

  // Wire permissions module with PG-backed grant store
  const grantStore = createPgGrantStore(pool);
  const permissions = createPermissions({ grantStore });

  app.use(express.json());

  // Idempotency middleware for mutating endpoints (POST, PUT, DELETE)
  app.use('/api', idempotencyMiddleware({
    cache: redisClient,
    exemptPaths: ['/share/'],
  }));

  // Wire event bus, audit, and workflow modules
  const config = loadConfig();
  const eventBus = createEventBus(pool, redisClient);
  const audit = createAudit({
    pool,
    eventBus,
    hmacSecret: config.audit.hmacSecret,
  });
  const workflow = createWorkflow({ pool, eventBus });
  const observability = createObservability({
    pool,
    healthIntervalMs: config.observability.healthIntervalMs,
  });
  if (config.observability.enabled) {
    observability.startHealthMonitor();
  }
  eventBus.startBackgroundJobs();

  // Serve static frontend
  const publicDir = resolve(__dirname, '../../app/internal/public');
  app.use(express.static(publicDir));

  // Auth middleware on all /api routes (except public paths)
  app.use('/api', auth.middleware);

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
  app.use('/api/documents', createSearchRoutes({ permissions }));

  // Document CRUD with permission checks
  app.use('/api/documents', createDocumentRoutes({ permissions, cache: redisClient }));

  // Version history routes (hocuspocus needed to invalidate sessions on restore)
  app.use('/api/documents/:id/versions', createVersionRoutes({ permissions, hocuspocus }));

  // Move document to folder
  app.use('/api/documents', createMoveDocumentRoute({ permissions }));

  // Folder CRUD
  app.use('/api/folders', createFolderRoutes({ permissions }));

  // Export/import routes with permission checks
  app.use('/api/documents', createExportRoutes({ permissions }));

  // Template CRUD routes
  app.use('/api/templates', createTemplateRoutes({ permissions }));

  // Reference management routes (DOI/ISBN lookup + CRUD)
  app.use('/api/references', createReferenceRoutes({ permissions }));

  // Reference import/export (BibTeX, RIS)
  app.use('/api/references', createImportExportRoutes({ permissions }));

  // Audit routes (crypto audit log + chain verification)
  app.use('/api/audit', createAuditRoutes({
    permissions,
    auditModule: audit,
    pool,
    hmacSecret: config.audit.hmacSecret,
  }));

  // Workflow routes (trigger/action CRUD + execution history)
  app.use('/api/workflows', createWorkflowRoutes({ permissions, workflowModule: workflow }));

  // Admin routes (user data purge)
  app.use('/api/admin', createAdminRoutes({ permissions, cache: redisClient }));

  // Observability metrics routes
  app.use('/api/admin/metrics', createMetricsRoutes({ observability, permissions }));

  // AI routes (semantic search, RAG assistant, embedding) — gated by config
  if (config.ai.enabled) {
    const ai = createAi({ pool, config: config.ai });
    app.use('/api/ai', createAiRoutes({ ai, permissions }));
  }

  // Share link routes (create, resolve, revoke) — after auth
  const shareLinkStore = createPgShareLinkStore(pool);
  const shareLinkService = createShareLinkService(shareLinkStore);
  const shareRateLimiter = createPasswordRateLimiter(redisClient);
  app.use(createShareRoutes({
    service: shareLinkService,
    grantStore: permissions.grantStore,
    permissions,
    rateLimiter: shareRateLimiter,
  }));

  // File upload and serving routes — after auth, with permission checks
  app.use('/api', createUploadRoutes({ permissions }));
  app.use('/api', createFileRoutes({ permissions }));

  // Global error handler — must be registered LAST (after all routes)
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    log.error('unhandled error', { error: err.message || err.stack || String(err) });
    res.status(500).json({ error: 'Internal server error' });
  });

  const httpServer = createServer(app);

  // Mount Hocuspocus WebSocket on /collab
  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/collab')) {
      handleUpgrade(request, socket, head);
    } else {
      socket.destroy();
    }
  });

  httpServer.listen(port, () => {
    log.info('server started', { port, http: `http://localhost:${port}`, ws: `ws://localhost:${port}/collab` });
  });

  // Graceful shutdown
  const shutdown = async () => {
    log.info('shutting down...');
    observability.stopHealthMonitor();
    eventBus.stopConsuming();
    eventBus.stopBackgroundJobs();
    await disconnectRedis();
    httpServer.close();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return httpServer;
}
