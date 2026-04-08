/** Contract: contracts/auth/rules.md */

import { describe, it, expect, vi } from 'vitest';
import { createInMemoryAuthRateLimiter, type AuthRateLimiter } from './auth-rate-limit.ts';
import { createAuthMiddleware } from './middleware.ts';
import type { TokenVerifier, ApiKeyVerifier } from '../contract.ts';
import type { Request, Response, NextFunction } from 'express';

describe('InMemoryAuthRateLimiter', () => {
  it('allows attempts below the threshold', async () => {
    const limiter = createInMemoryAuthRateLimiter({ maxFailures: 3, windowSeconds: 60 });
    expect(await limiter.check('1.2.3.4')).toBe(true);
    await limiter.recordFailure('1.2.3.4');
    await limiter.recordFailure('1.2.3.4');
    expect(await limiter.check('1.2.3.4')).toBe(true); // 2 < 3
  });

  it('blocks at the threshold', async () => {
    const limiter = createInMemoryAuthRateLimiter({ maxFailures: 2, windowSeconds: 60 });
    await limiter.recordFailure('1.2.3.4');
    await limiter.recordFailure('1.2.3.4');
    expect(await limiter.check('1.2.3.4')).toBe(false);
  });

  it('tracks IPs independently', async () => {
    const limiter = createInMemoryAuthRateLimiter({ maxFailures: 1, windowSeconds: 60 });
    await limiter.recordFailure('1.1.1.1');
    expect(await limiter.check('1.1.1.1')).toBe(false);
    expect(await limiter.check('2.2.2.2')).toBe(true);
  });

  it('resets after window expires', async () => {
    vi.useFakeTimers();
    const limiter = createInMemoryAuthRateLimiter({ maxFailures: 1, windowSeconds: 10 });
    await limiter.recordFailure('1.2.3.4');
    expect(await limiter.check('1.2.3.4')).toBe(false);
    vi.advanceTimersByTime(11_000);
    expect(await limiter.check('1.2.3.4')).toBe(true);
    vi.useRealTimers();
  });
});

describe('Auth Middleware with rate limiter', () => {
  const failToken: TokenVerifier = {
    async verifyToken() { return { ok: false, error: { code: 'TOKEN_INVALID', message: 'bad' } }; },
  };
  const failKey: ApiKeyVerifier = {
    async verifyApiKey() { return { ok: false, error: { code: 'KEY_INVALID', message: 'bad' } }; },
  };

  function mockReq(headers: Record<string, string> = {}): Partial<Request> {
    return { headers, path: '/api/test', ip: '10.0.0.1', socket: { remoteAddress: '10.0.0.1' } as never };
  }

  function mockRes(): Partial<Response> & { statusCode: number; body: unknown } {
    const res = {
      statusCode: 200,
      body: null as unknown,
      status(code: number) { res.statusCode = code; return res as unknown as Response; },
      json(data: unknown) { res.body = data; return res as unknown as Response; },
    };
    return res;
  }

  it('returns 429 when rate limit exceeded', async () => {
    const limiter = createInMemoryAuthRateLimiter({ maxFailures: 2, windowSeconds: 60 });
    const mw = createAuthMiddleware({
      tokenVerifier: failToken,
      apiKeyVerifier: failKey,
      authRateLimiter: limiter,
    });

    // Burn through the limit with failed attempts
    for (let i = 0; i < 2; i++) {
      const req = mockReq({ authorization: 'Bearer bad' });
      const res = mockRes();
      await mw(req as Request, res as unknown as Response, vi.fn() as NextFunction);
      expect(res.statusCode).toBe(401);
    }

    // Next attempt should be rate limited
    const req = mockReq({ authorization: 'Bearer bad' });
    const res = mockRes();
    await mw(req as Request, res as unknown as Response, vi.fn() as NextFunction);
    expect(res.statusCode).toBe(429);
    expect((res.body as { error: { code: string } }).error.code).toBe('AUTH_RATE_LIMITED');
  });

  it('records failures for missing credentials too', async () => {
    const limiter = createInMemoryAuthRateLimiter({ maxFailures: 1, windowSeconds: 60 });
    const mw = createAuthMiddleware({
      tokenVerifier: failToken,
      apiKeyVerifier: failKey,
      authRateLimiter: limiter,
    });

    // No credentials = 401 + recorded failure
    const req1 = mockReq({});
    const res1 = mockRes();
    await mw(req1 as Request, res1 as unknown as Response, vi.fn() as NextFunction);
    expect(res1.statusCode).toBe(401);

    // Now rate limited
    const req2 = mockReq({});
    const res2 = mockRes();
    await mw(req2 as Request, res2 as unknown as Response, vi.fn() as NextFunction);
    expect(res2.statusCode).toBe(429);
  });
});
