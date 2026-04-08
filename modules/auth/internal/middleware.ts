/** Contract: contracts/auth/rules.md */

import type { Request, Response, NextFunction } from 'express';
import type { Principal, TokenVerifier, ApiKeyVerifier } from '../contract.ts';
import type { AuthRateLimiter } from './auth-rate-limit.ts';

/**
 * Extend Express Request to carry the resolved Principal.
 */
declare global {
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}

export type AuthMiddlewareOptions = {
  tokenVerifier: TokenVerifier;
  apiKeyVerifier: ApiKeyVerifier;
  /** Paths that skip authentication (e.g. /api/health) */
  publicPaths?: string[];
  /** Optional rate limiter for failed auth attempts per IP. */
  authRateLimiter?: AuthRateLimiter;
};

/**
 * Express middleware that extracts credentials from the request,
 * verifies them, and populates req.principal.
 *
 * Credentials are checked in order:
 * 1. X-Api-Key header -> API key verification
 * 2. Authorization: Bearer <token> -> Token verification
 *
 * No caching — each request re-verifies (contract invariant).
 */
export function createAuthMiddleware(opts: AuthMiddlewareOptions) {
  const publicPaths = opts.publicPaths || [];
  const rateLimiter = opts.authRateLimiter;

  /** Send a 401, recording the failure if rate limiter is active. */
  async function reject(req: Request, res: Response, error: unknown): Promise<void> {
    if (rateLimiter) {
      const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
      await rateLimiter.recordFailure(ip);
    }
    res.status(401).json({ error });
  }

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (publicPaths.some((p) => req.path === p || req.path.startsWith(p + '/'))) {
      next();
      return;
    }

    // Check auth failure rate limit before processing credentials
    if (rateLimiter) {
      const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
      const allowed = await rateLimiter.check(ip);
      if (!allowed) {
        res.status(429).json({
          error: { code: 'AUTH_RATE_LIMITED', message: 'Too many failed authentication attempts. Try again later.' },
        });
        return;
      }
    }

    const apiKey = req.headers['x-api-key'];
    if (typeof apiKey === 'string' && apiKey.length > 0) {
      const result = await opts.apiKeyVerifier.verifyApiKey(apiKey);
      if (result.ok) {
        req.principal = result.principal;
        next();
        return;
      }
      await reject(req, res, result.error);
      return;
    }

    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const result = await opts.tokenVerifier.verifyToken(token);
      if (result.ok) {
        req.principal = result.principal;
        next();
        return;
      }
      await reject(req, res, result.error);
      return;
    }

    await reject(req, res, { code: 'TOKEN_INVALID', message: 'No credentials provided' });
  };
}
