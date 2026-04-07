/** Contract: contracts/api/rules.md — Idempotency middleware tests */
import { describe, it, expect, beforeEach } from 'vitest';
import type { NextFunction } from 'express';
import type { CacheClient } from './redis.ts';
import {
  buildCacheKey,
  serializeResponse,
  deserializeResponse,
  idempotencyMiddleware,
  IDEMPOTENCY_TTL_SECONDS,
  IDEMPOTENCY_KEY_PREFIX,
} from './idempotency.ts';
import { InMemoryCache, makeReq, makeRes } from './test-helpers.ts';

// --- Unit tests: cache key generation ---

describe('buildCacheKey', () => {
  it('builds a deterministic key from method, path, principal, and idempotency key', () => {
    const key = buildCacheKey('POST', '/api/documents', 'user-1', 'abc-123');
    expect(key).toBe(`${IDEMPOTENCY_KEY_PREFIX}POST:/api/documents:user-1:abc-123`);
  });

  it('different methods produce different keys', () => {
    const a = buildCacheKey('POST', '/api/documents', 'user-1', 'key-1');
    const b = buildCacheKey('DELETE', '/api/documents', 'user-1', 'key-1');
    expect(a).not.toBe(b);
  });

  it('different paths produce different keys', () => {
    const a = buildCacheKey('POST', '/api/documents', 'user-1', 'key-1');
    const b = buildCacheKey('POST', '/api/documents/123', 'user-1', 'key-1');
    expect(a).not.toBe(b);
  });

  it('different principals produce different keys', () => {
    const a = buildCacheKey('POST', '/api/documents', 'user-1', 'key-1');
    const b = buildCacheKey('POST', '/api/documents', 'user-2', 'key-1');
    expect(a).not.toBe(b);
  });
});

// --- Unit tests: response serialization ---

describe('serializeResponse / deserializeResponse', () => {
  it('round-trips correctly', () => {
    const serialized = serializeResponse(201, { 'content-type': 'application/json' }, '{"id":"123"}');
    const deserialized = deserializeResponse(serialized);
    expect(deserialized.statusCode).toBe(201);
    expect(deserialized.headers['content-type']).toBe('application/json');
    expect(deserialized.body).toBe('{"id":"123"}');
  });

  it('handles empty body', () => {
    const serialized = serializeResponse(204, {}, '');
    const deserialized = deserializeResponse(serialized);
    expect(deserialized.statusCode).toBe(204);
    expect(deserialized.body).toBe('');
  });
});

// --- TTL configuration ---

describe('IDEMPOTENCY_TTL_SECONDS', () => {
  it('is 24 hours per collab contract', () => {
    expect(IDEMPOTENCY_TTL_SECONDS).toBe(24 * 60 * 60);
  });
});

// --- Middleware behavior ---

describe('idempotencyMiddleware', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache();
  });

  it('passes through GET requests without requiring header', async () => {
    const middleware = idempotencyMiddleware({ cache });
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };
    await middleware(req, res, next);
    expect(nextCalled).toBe(true);
  });

  it('returns 400 when Idempotency-Key header is missing on POST', async () => {
    const middleware = idempotencyMiddleware({ cache });
    const req = makeReq({ method: 'POST', headers: {} });
    const res = makeRes();
    await middleware(req, res, () => {});
    expect(res._status).toBe(400);
    expect((res._body as { code: string }).code).toBe('MISSING_IDEMPOTENCY_KEY');
  });

  it('returns 400 when Idempotency-Key header is missing on DELETE', async () => {
    const middleware = idempotencyMiddleware({ cache });
    const req = makeReq({ method: 'DELETE', headers: {} });
    const res = makeRes();
    await middleware(req, res, () => {});
    expect(res._status).toBe(400);
  });

  it('calls next() on first request with a new idempotency key', async () => {
    const middleware = idempotencyMiddleware({ cache });
    const req = makeReq({ method: 'POST', headers: { 'idempotency-key': 'unique-key-1' } });
    const res = makeRes();
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('returns cached response on duplicate idempotency key', async () => {
    const middleware = idempotencyMiddleware({ cache });

    const req1 = makeReq({ method: 'POST', path: '/api/documents', headers: { 'idempotency-key': 'dup-key' } });
    const res1 = makeRes();
    res1.setHeader('content-type', 'application/json');
    await middleware(req1, res1, () => {});

    res1.status(201);
    res1.json({ id: 'doc-42' });
    await new Promise((r) => setTimeout(r, 10));

    const req2 = makeReq({ method: 'POST', path: '/api/documents', headers: { 'idempotency-key': 'dup-key' } });
    const res2 = makeRes();
    let next2Called = false;
    await middleware(req2, res2, () => { next2Called = true; });

    expect(next2Called).toBe(false);
    expect(res2._status).toBe(201);
    expect(res2._body).toBe('{"id":"doc-42"}');
    expect(res2._headers['X-Idempotent-Replayed']).toBe('true');
  });

  it('does not cache 5xx responses', async () => {
    const middleware = idempotencyMiddleware({ cache });
    const req = makeReq({ method: 'POST', path: '/api/docs', headers: { 'idempotency-key': 'err-key' } });
    const res1 = makeRes();
    await middleware(req, res1, () => {});
    res1.status(500);
    res1.json({ error: 'internal' });
    await new Promise((r) => setTimeout(r, 10));

    const req2 = makeReq({ method: 'POST', path: '/api/docs', headers: { 'idempotency-key': 'err-key' } });
    const res2 = makeRes();
    let nextCalled = false;
    await middleware(req2, res2, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('survives cache read errors gracefully', async () => {
    const failingCache: CacheClient = {
      get: async () => { throw new Error('connection lost'); },
      set: async () => 'OK',
      quit: async () => 'OK',
      status: 'ready',
    };
    const middleware = idempotencyMiddleware({ cache: failingCache });
    const req = makeReq({ method: 'POST', headers: { 'idempotency-key': 'fail-key' } });
    const res = makeRes();
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('respects custom methods configuration', async () => {
    const middleware = idempotencyMiddleware({ cache, methods: ['POST'] });
    const req = makeReq({ method: 'DELETE', headers: {} });
    const res = makeRes();
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });
});
