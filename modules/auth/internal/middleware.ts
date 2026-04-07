/** Contract: contracts/auth/rules.md */

import type { Request, Response, NextFunction } from 'express';
import type { Principal, TokenVerifier, ApiKeyVerifier } from '../contract.ts';

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

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (publicPaths.some((p) => req.path === p || req.path.startsWith(p + '/'))) {
      next();
      return;
    }

    const apiKey = req.headers['x-api-key'];
    if (typeof apiKey === 'string' && apiKey.length > 0) {
      const result = await opts.apiKeyVerifier.verifyApiKey(apiKey);
      if (result.ok) {
        req.principal = result.principal;
        next();
        return;
      }
      res.status(401).json({ error: result.error });
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
      res.status(401).json({ error: result.error });
      return;
    }

    res.status(401).json({
      error: { code: 'TOKEN_INVALID', message: 'No credentials provided' },
    });
  };
}
