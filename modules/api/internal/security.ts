/** Contract: contracts/api/rules.md */

import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Express } from 'express';
import type { Redis } from 'ioredis';
import { loadConfig } from '../../config/index.ts';

export interface SecurityMiddlewareOptions {
  /** Redis client for distributed rate limiting across instances. */
  redis?: Redis;
}

/**
 * Apply security middleware to the Express app:
 * - CORS with configurable origins
 * - Helmet security headers (CSP, HSTS, X-Frame-Options, etc.)
 * - Global rate limiting per IP (Redis-backed when client provided)
 */
export function applySecurityMiddleware(app: Express, opts?: SecurityMiddlewareOptions): void {
  const config = loadConfig();
  const origins = config.server.corsOrigins;

  // CORS — restrict to configured origins, or allow same-origin only if none set
  app.use(cors({
    origin: origins.length > 0 ? origins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Filename'],
    maxAge: 86400,
  }));

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Theme-detection inline scripts (editor.html + index.html)
          "'sha256-P0tJR3Q9jyRl1vNpgiYrKQGPWs8ReNY1F3D0m/F6QzA='",
          // Theme-detection inline script (share.html — no comment variant)
          "'sha256-2u/Uh4z9crM/+6p4RwTBXMk5W4tz0+QA4BL+MIhhclQ='",
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
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
