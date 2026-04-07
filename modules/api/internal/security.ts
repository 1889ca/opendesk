/** Contract: contracts/api/rules.md */

import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { Express } from 'express';
import { loadConfig } from '../../config/index.ts';

/**
 * Apply security middleware to the Express app:
 * - CORS with configurable origins
 * - Helmet security headers (CSP, HSTS, X-Frame-Options, etc.)
 * - Global rate limiting per IP
 */
export function applySecurityMiddleware(app: Express): void {
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
        scriptSrc: ["'self'"],
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
  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
    skip: (req) => req.path === '/health',
  }));
}
