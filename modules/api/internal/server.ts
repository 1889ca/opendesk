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
import { createPermissions } from '../../permissions/index.ts';
import { createDocumentRoutes } from './document-routes.ts';
import { createExportRoutes } from './export-routes.ts';
import { createAdminRoutes } from './admin-routes.ts';
import { createUploadRoutes } from './upload-routes.ts';
import { createFileRoutes } from './file-routes.ts';
import { createTemplateRoutes } from './template-routes.ts';
import { createVersionRoutes } from './version-routes.ts';
import { createFolderRoutes, createMoveDocumentRoute } from './folder-routes.ts';
import { createSearchRoutes } from './search-routes.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function startServer(port = 3000) {
  const app = express();

  // Wire auth module (dev mode uses bypass verifiers)
  const auth = createAuth({
    serviceAccountStore: { findByKeyHash: async () => null },
    serviceAccountStorage: {
      insertServiceAccount: async () => {},
      findServiceAccountById: async () => null,
      revokeServiceAccount: async () => {},
    },
    publicPaths: ['/api/health'],
  });

  // Wire collab server with auth dependency
  const { handleUpgrade, hocuspocus } = createCollabServer({
    tokenVerifier: auth.tokenVerifier,
  });

  // Wire permissions module
  const permissions = createPermissions();

  app.use(express.json());

  // Idempotency middleware for mutating endpoints (POST, PUT, DELETE)
  const redisClient = getRedisClient();
  app.use('/api', idempotencyMiddleware({ cache: redisClient }));

  // Serve static frontend
  const publicDir = resolve(__dirname, '../../app/internal/public');
  app.use(express.static(publicDir));

  // Auth middleware on all /api routes (except public paths)
  app.use('/api', auth.middleware);

  // Collabora convert routes (import/export binary formats) — after auth
  app.use(createConvertRoutes());

  // Health check (public, skipped by auth middleware)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0' });
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

  // Admin routes (user data purge)
  app.use('/api/admin', createAdminRoutes({ permissions, cache: redisClient }));

  // File upload and serving routes — after auth
  app.use('/api', createUploadRoutes());
  app.use('/api', createFileRoutes());

  // Global error handler — must be registered LAST (after all routes)
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[opendesk] unhandled error:', err.message);
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
