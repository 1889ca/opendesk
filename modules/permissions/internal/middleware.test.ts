/** Contract: contracts/permissions/rules.md — Middleware tests */
import { describe, it, expect, beforeEach } from 'vitest';
import { requirePermission, requireAuth } from './middleware.ts';
import { createInMemoryGrantStore, type GrantStore } from './grant-store.ts';
import type { Principal } from '../../auth/contract.ts';

/** Minimal Express-like request for testing. */
function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    params: { id: 'doc-1' },
    principal: undefined as Principal | undefined,
    ...overrides,
  } as unknown as import('express').Request;
}

/** Minimal Express-like response that captures status and json. */
function makeRes() {
  let statusCode = 200;
  let body: unknown = null;
  const res = {
    status(code: number) { statusCode = code; return res; },
    json(data: unknown) { body = data; return res; },
    get statusCode() { return statusCode; },
    get body() { return body; },
  };
  return res as unknown as import('express').Response & { statusCode: number; body: unknown };
}

const testPrincipal: Principal = {
  id: 'user-1',
  actorType: 'human',
  displayName: 'Alice',
  scopes: [],
};

describe('requireAuth()', () => {
  it('returns 401 when no principal', () => {
    const req = makeReq();
    const res = makeRes();
    let nextCalled = false;
    requireAuth()(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it('calls next when principal exists', () => {
    const req = makeReq({ principal: testPrincipal });
    const res = makeRes();
    let nextCalled = false;
    requireAuth()(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });
});

describe('requirePermission()', () => {
  let store: GrantStore;

  beforeEach(() => {
    store = createInMemoryGrantStore();
  });

  it('returns 401 when no principal', async () => {
    const middleware = requirePermission('read', { grantStore: store });
    const req = makeReq();
    const res = makeRes();
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it('returns 403 when no grant exists', async () => {
    const middleware = requirePermission('read', { grantStore: store });
    const req = makeReq({ principal: testPrincipal });
    const res = makeRes();
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(403);
    expect(nextCalled).toBe(false);
  });

  it('allows access with valid grant', async () => {
    await store.create({
      principalId: 'user-1',
      resourceId: 'doc-1',
      resourceType: 'document',
      role: 'viewer',
      grantedBy: 'admin',
    });
    const middleware = requirePermission('read', { grantStore: store });
    const req = makeReq({ principal: testPrincipal });
    const res = makeRes();
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('returns 403 when grant has insufficient role', async () => {
    await store.create({
      principalId: 'user-1',
      resourceId: 'doc-1',
      resourceType: 'document',
      role: 'viewer',
      grantedBy: 'admin',
    });
    const middleware = requirePermission('write', { grantStore: store });
    const req = makeReq({ principal: testPrincipal });
    const res = makeRes();
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(403);
    expect(nextCalled).toBe(false);
  });

  it('returns 403 for expired grant', async () => {
    await store.create({
      principalId: 'user-1',
      resourceId: 'doc-1',
      resourceType: 'document',
      role: 'owner',
      grantedBy: 'admin',
      expiresAt: new Date(Date.now() - 60000).toISOString(),
    });
    const middleware = requirePermission('read', { grantStore: store });
    const req = makeReq({ principal: testPrincipal });
    const res = makeRes();
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(403);
    expect(nextCalled).toBe(false);
  });

  it('allows owner to perform editor actions (role hierarchy)', async () => {
    await store.create({
      principalId: 'user-1',
      resourceId: 'doc-1',
      resourceType: 'document',
      role: 'owner',
      grantedBy: 'admin',
    });
    for (const action of ['read', 'write', 'comment', 'delete', 'share', 'manage'] as const) {
      const middleware = requirePermission(action, { grantStore: store });
      const req = makeReq({ principal: testPrincipal });
      const res = makeRes();
      let nextCalled = false;
      await middleware(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    }
  });

  it('treats agent principals the same as human principals', async () => {
    const agentPrincipal: Principal = {
      id: 'agent-1',
      actorType: 'agent',
      displayName: 'Bot',
      scopes: [],
    };
    await store.create({
      principalId: 'agent-1',
      resourceId: 'doc-1',
      resourceType: 'document',
      role: 'editor',
      grantedBy: 'admin',
    });
    const middleware = requirePermission('write', { grantStore: store });
    const req = makeReq({ principal: agentPrincipal });
    const res = makeRes();
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('returns 400 when resource id is missing', async () => {
    const middleware = requirePermission('read', { grantStore: store });
    const req = makeReq({ principal: testPrincipal, params: {} });
    const res = makeRes();
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(400);
    expect(nextCalled).toBe(false);
  });
});
