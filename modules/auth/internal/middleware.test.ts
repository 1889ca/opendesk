/** Contract: contracts/auth/rules.md */

import { describe, it, expect, vi } from 'vitest';
import { createAuthMiddleware } from './middleware.ts';
import type { TokenVerifier, ApiKeyVerifier, Principal } from '../contract.ts';
import type { Request, Response, NextFunction } from 'express';

function mockReq(headers: Record<string, string> = {}, path = '/api/test'): Partial<Request> {
  return { headers, path };
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

const humanPrincipal: Principal = {
  id: 'u1', actorType: 'human', displayName: 'Test', scopes: ['read'],
};

const agentPrincipal: Principal = {
  id: 'a1', actorType: 'agent', displayName: 'Bot', scopes: ['*'],
};

const okToken: TokenVerifier = {
  async verifyToken() { return { ok: true, principal: humanPrincipal }; },
};

const failToken: TokenVerifier = {
  async verifyToken() { return { ok: false, error: { code: 'TOKEN_INVALID', message: 'bad' } }; },
};

const okKey: ApiKeyVerifier = {
  async verifyApiKey() { return { ok: true, principal: agentPrincipal }; },
};

const failKey: ApiKeyVerifier = {
  async verifyApiKey() { return { ok: false, error: { code: 'KEY_INVALID', message: 'bad' } }; },
};

describe('Auth Middleware', () => {
  it('passes through public paths without auth', async () => {
    const mw = createAuthMiddleware({ tokenVerifier: failToken, apiKeyVerifier: failKey, publicPaths: ['/api/health'] });
    const req = mockReq({}, '/api/health');
    const res = mockRes();
    const next = vi.fn();
    await mw(req as Request, res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it('resolves API key via X-Api-Key header', async () => {
    const mw = createAuthMiddleware({ tokenVerifier: failToken, apiKeyVerifier: okKey });
    const req = mockReq({ 'x-api-key': 'some-key' });
    const next = vi.fn();
    await mw(req as Request, mockRes() as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
    expect((req as Request).principal).toEqual(agentPrincipal);
  });

  it('resolves Bearer token', async () => {
    const mw = createAuthMiddleware({ tokenVerifier: okToken, apiKeyVerifier: failKey });
    const req = mockReq({ authorization: 'Bearer tok123' });
    const next = vi.fn();
    await mw(req as Request, mockRes() as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
    expect((req as Request).principal).toEqual(humanPrincipal);
  });

  it('returns 401 for invalid Bearer token', async () => {
    const mw = createAuthMiddleware({ tokenVerifier: failToken, apiKeyVerifier: failKey });
    const req = mockReq({ authorization: 'Bearer bad' });
    const res = mockRes();
    const next = vi.fn();
    await mw(req as Request, res as unknown as Response, next as NextFunction);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when no credentials provided', async () => {
    const mw = createAuthMiddleware({ tokenVerifier: okToken, apiKeyVerifier: okKey });
    const req = mockReq({});
    const res = mockRes();
    const next = vi.fn();
    await mw(req as Request, res as unknown as Response, next as NextFunction);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('prefers API key over Bearer token', async () => {
    const mw = createAuthMiddleware({ tokenVerifier: okToken, apiKeyVerifier: okKey });
    const req = mockReq({ 'x-api-key': 'key', authorization: 'Bearer tok' });
    const next = vi.fn();
    await mw(req as Request, mockRes() as unknown as Response, next as NextFunction);
    expect((req as Request).principal?.actorType).toBe('agent');
  });
});
