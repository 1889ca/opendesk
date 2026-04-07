/** Contract: contracts/api/rules.md */

import type { Request, Response, NextFunction } from 'express';

type AsyncRouteHandler = (req: Request, res: Response) => Promise<void>;

/**
 * Wrap an async Express route handler so rejected promises
 * are forwarded to Express error-handling middleware via next().
 */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}
