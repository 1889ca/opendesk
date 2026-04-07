/** Contract: contracts/api/rules.md */
import { createServer } from 'node:http';
import express, { type Request, type Response, type NextFunction } from 'express';
import { resolve, dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
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
import {
  createShareLinkService,
  createPgShareLinkStore,
  createShareRoutes,
} from '../../sharing/index.ts';
import { pool, initSchema } from '../../storage/index.ts';
import { ensureS3Bucket } from './s3-client.ts';
import { applySecurityMiddleware } from './security.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_VERSION = JSON.parse(
  readFileSync(join(__dirname, '../../../package.json'), 'utf-8'),
).version as string;

export async function startServer(port = 3000) {
  try {
    await initSchema();
    console.log('[opendesk] database schema initialized');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[opendesk] schema init failed: ${msg} — continuing anyway`);
  }
  try {
    await ensureS3Bucket();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[s3] bucket init failed: ${msg} — uploads may fail`);
  }
  const app = express();

  // Security middleware (CORS, helmet, rate limiting) — must be first
  applySecurityMiddleware(app);

  // Wire auth module (dev mode uses bypass verifiers)
  const auth = createAuth({
    serviceAccountStore: { findByKeyHash: async () => null },
    serviceAccountStorage: {
      insertServiceAccount: async () => {},
      findServiceAccountById: async () => null,
      revokeServiceAccount: async () => {},
    },
    publicPaths: ['/api/health', '/share'],
  });

  // Wire collab server with auth dependency
  const { handleUpgrade, hocuspocus } = createCollabServer({
    tokenVerifier: auth.tokenVerifier,
  });

  // Wire permissions module with PG-backed grant store
  const grantStore = createPgGrantStore(pool);
  const permissions = createPermissions({ grantStore });

  app.use(express.json());
  app.use(express.text({ type: ['application/x-bibtex', 'application/x-ris'] }));

  // Idempotency middleware for mutating endpoints (POST, PUT, DELETE)
  const redisClient = getRedisClient();
  app.use('/api', idempotencyMiddleware({
    cache: redisClient,
    exemptPaths: ['/share/'],
  }));

  // Serve static frontend
  const publicDir = resolve(__dirname, '../../app/internal/public');
  app.use(express.static(publicDir));

  // Auth middleware on all /api routes (except public paths)
  app.use('/api', auth.middleware);

  // Collabora convert routes (import/export binary formats) — after auth
  app.use(createConvertRoutes({ permissions }));

  // Health check (public, skipped by auth middleware)
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', version: PKG_VERSION });
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

  // Admin routes (user data purge)
  app.use('/api/admin', createAdminRoutes({ permissions, cache: redisClient }));

  // Share link routes (create, resolve, revoke) — after auth
  const shareLinkStore = createPgShareLinkStore(pool);
  const shareLinkService = createShareLinkService(shareLinkStore);
  app.use(createShareRoutes({
    service: shareLinkService,
    grantStore: permissions.grantStore,
    permissions,
  }));

  // File upload and serving routes — after auth, with permission checks
  app.use('/api', createUploadRoutes({ permissions }));
  app.use('/api', createFileRoutes({ permissions }));

  // Global error handler — must be registered LAST (after all routes)
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[opendesk] unhandled error:', err.message || err.stack || err);
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
    console.log(`[opendesk] server running at http://localhost:${port}`);
    console.log(`[opendesk] WebSocket collab at ws://localhost:${port}/collab`);
  });

  // Graceful shutdown: disconnect Redis on process exit
  const shutdown = async () => {
    console.log('[opendesk] shutting down...');
    await disconnectRedis();
    httpServer.close();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return httpServer;
}
