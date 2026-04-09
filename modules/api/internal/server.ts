/** Contract: contracts/api/rules.md */
import { createServer } from 'node:http';
import express, { type Request, type Response, type NextFunction } from 'express';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCollabServer } from '../../collab/index.ts';
import { getRedisClient, setRedisConfig, disconnectRedis } from './redis.ts';
import { createAuth, createAuthRateLimiter } from '../../auth/index.ts';
import { createPermissions, createPgGrantStore } from '../../permissions/index.ts';
import { createShareLinkService, createPgShareLinkStore, createPasswordRateLimiter } from '../../sharing/index.ts';
import { pool, initPool, initSchema } from '../../storage/index.ts';
import { initCollabora } from '../../convert/index.ts';
import { ensureS3Bucket, initS3 } from './s3-client.ts'; import { applySecurityMiddleware } from './security.ts';
import { createEventBus } from '../../events/index.ts';
import { createAudit } from '../../audit/index.ts';
import { createWorkflow } from '../../workflow/index.ts';
import { createObservability } from '../../observability/index.ts';
import { loadConfig } from '../../config/index.ts';
import { createLogger } from '../../logger/index.ts';
import { mountRoutes } from './create-routes.ts';

const log = createLogger('api');
const __dirname = dirname(fileURLToPath(import.meta.url));

export async function startServer(port = 3000) {
  // Load config once at composition root — threaded to all modules via DI
  const config = loadConfig();

  // Inject module configs from composition root (dependency injection)
  initPool(config.postgres);
  initS3(config.s3);
  initCollabora(config.collabora);
  setRedisConfig(config.redis);

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

  // Trust first proxy (nginx) so req.ip reflects the real client IP (SEC-03)
  app.set('trust proxy', 1);

  // Redis client needed for rate limiting + idempotency + caching
  const redisClient = getRedisClient();

  // Security middleware (CORS, helmet, rate limiting) — must be first
  applySecurityMiddleware(app, { redis: redisClient, serverConfig: config.server });

  // Wire auth module (dev mode uses bypass verifiers)
  // Auth failure rate limiter — 10 failed attempts per 15 min per IP (brute-force protection)
  const authRateLimiter = createAuthRateLimiter(redisClient);
  const auth = createAuth({
    serviceAccountStore: { findByKeyHash: async () => null },
    serviceAccountStorage: {
      insertServiceAccount: async () => {},
      findServiceAccountById: async () => null,
      revokeServiceAccount: async () => {},
    },
    publicPaths: ['/health'],
    authRateLimiter,
    nodeEnv: config.server.nodeEnv,
  });

  // Wire permissions module with PG-backed grant store.
  // Must be created BEFORE collab so the WS authenticate hook can
  // gate document access (issue #125).
  const grantStore = createPgGrantStore(pool);
  const permissions = createPermissions({ grantStore, authMode: config.auth.mode });

  // Wire collab server with auth + permissions dependencies.
  const { handleUpgrade, hocuspocus } = createCollabServer({
    tokenVerifier: auth.tokenVerifier,
    permissions,
  });

  // Wire event bus, audit, and workflow modules
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

  // Share link service
  const shareLinkStore = createPgShareLinkStore(pool);
  const shareLinkService = createShareLinkService(shareLinkStore);
  const shareRateLimiter = createPasswordRateLimiter(redisClient);

  // Mount all API routes
  const publicDir = resolve(__dirname, '../../app/internal/public');
  const { ai } = mountRoutes({
    app, auth, permissions, hocuspocus, redisClient,
    config, eventBus, audit, workflow, observability,
    shareLinkService, shareRateLimiter, publicDir,
  });

  // SPA catch-all: serve spa.html for any non-API, non-static route
  // This enables client-side routing (pushState) to work for all app routes
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    // Skip API routes and requests for static files (with extensions)
    if (req.path.startsWith('/api/') || req.path.startsWith('/collab') || /\.\w+$/.test(req.path)) {
      return next();
    }
    res.sendFile(resolve(publicDir, 'spa.html'));
  });

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
    if (ai) ai.stopConsumer();
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
