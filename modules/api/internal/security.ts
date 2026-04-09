/** Contract: contracts/api/rules.md */

import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Express, Response } from 'express';
import type { Redis } from 'ioredis';
import type { ServerConfig } from '../../config/contract.ts';
import { cspNonceMiddleware } from './csp-nonce.ts';

export interface SecurityMiddlewareOptions {
  /** Redis client for distributed rate limiting across instances. */
  redis?: Redis;
  /** Server config for CORS origins. */
  serverConfig: ServerConfig;
}

/**
 * Apply security middleware to the Express app:
 * - CORS with configurable origins
 * - Helmet security headers (CSP, HSTS, X-Frame-Options, etc.)
 * - Global rate limiting per IP (Redis-backed when client provided)
 */
export function applySecurityMiddleware(app: Express, opts: SecurityMiddlewareOptions): void {
  const origins = opts.serverConfig.corsOrigins;

  // Generate a unique CSP nonce per request (L11). The nonce is
  // stored on res.locals.cspNonce and referenced by both the
  // helmet CSP directive (below) and the HTML-serving middleware
  // that injects it into inline <script> tags.
  app.use(cspNonceMiddleware());

  // CORS — restrict to configured origins, or allow same-origin only if none set
  app.use(cors({
    origin: origins.length > 0 ? origins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Filename'],
    maxAge: 86400,
  }));

  // Security headers — nonce-based CSP replaces the previous sha256
  // hash approach (L11). Each response gets a unique nonce so only
  // scripts the server explicitly annotates will execute. The nonce
  // function reads from res.locals, which cspNonceMiddleware set above.
  app.use(helmet({
    // Disable HSTS in non-production: setting it on a plain-HTTP dev server
    // causes Safari (which strictly enforces HSTS) to refuse subsequent
    // resource loads over HTTP, producing TLS errors in the browser.
    hsts: opts.serverConfig.nodeEnv === 'production',
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          (_req, res) => `'nonce-${(res as Response).locals.cspNonce}'`,
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        // 'self' covers same-origin ws:// and wss:// connections.
        // Bare scheme sources ('ws:' / 'wss:') are not supported by Safari
        // (they cause a CSP parse error in WebKit which can cascade to blocking
        // all script execution on the page). Explicit same-origin is correct
        // and sufficient for the Hocuspocus collab endpoint. (#185)
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        // Only upgrade insecure requests when running behind HTTPS (production).
        // On a plain-HTTP dev server this directive tells Safari to fetch all
        // subresources over HTTPS, which fails with a TLS error. (#185)
        ...(opts.serverConfig.nodeEnv === 'production' ? { upgradeInsecureRequests: [] } : { upgradeInsecureRequests: null }),
      },
    },
    crossOriginEmbedderPolicy: false, // allow loading images from S3
  }));

  // Global rate limiting — 100 requests per minute per IP
  // Uses Redis store when available for consistent counts across instances
  const rateLimitStore = opts?.redis
    ? new RedisStore({
        // rate-limit-redis v4 spreads command array into sendCommand args
        sendCommand: (...args: string[]) =>
          opts.redis!.call(args[0], ...args.slice(1)) as Promise<number | string>,
        prefix: 'opendesk:rl:',
      })
    : undefined;

  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
    skip: (req) => req.path === '/health',
    ...(rateLimitStore ? { store: rateLimitStore } : {}),
  }));
}
