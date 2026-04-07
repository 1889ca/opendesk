/** Contract: contracts/api/rules.md */

import { describe, it, expect } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { asyncHandler } from './async-handler.ts';

function createTestApp() {
  const app = express();

  // A route that throws synchronously inside an async handler
  app.get(
    '/throws',
    asyncHandler(async (_req: Request, _res: Response) => {
      throw new Error('boom');
    })
  );

  // A route that rejects asynchronously
  app.get(
    '/rejects',
    asyncHandler(async (_req: Request, _res: Response) => {
      await Promise.reject(new Error('async boom'));
    })
  );

  // A route that succeeds
  app.get(
    '/ok',
    asyncHandler(async (_req: Request, res: Response) => {
      res.json({ ok: true });
    })
  );

  // Express error-handling middleware (must have 4 params)
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

describe('asyncHandler', () => {
  it('returns 500 when handler throws synchronously', async () => {
    const res = await request(createTestApp()).get('/throws');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });

  it('returns 500 when handler rejects asynchronously', async () => {
    const res = await request(createTestApp()).get('/rejects');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });

  it('returns 200 when handler succeeds', async () => {
    const res = await request(createTestApp()).get('/ok');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
