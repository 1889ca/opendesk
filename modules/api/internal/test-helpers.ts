/** Contract: contracts/api/rules.md */
/** Shared test helpers for api module tests. */
import type { Request, Response } from 'express';
import type { CacheClient } from './redis.ts';

/** In-memory cache implementing CacheClient — a real Map-backed store, not a mock. */
export class InMemoryCache implements CacheClient {
  private store = new Map<string, { value: string; expiresAt: number }>();
  status = 'ready';

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, _mode: 'EX', ttl: number): Promise<string | null> {
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async quit(): Promise<string> {
    this.store.clear();
    return 'OK';
  }

  clear(): void {
    this.store.clear();
  }
}

export type TestResponse = Response & {
  _status: number;
  _body: unknown;
  _headers: Record<string, string>;
};

export function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    path: '/api/documents',
    headers: {},
    ...overrides,
  } as unknown as Request;
}

export function makeRes(): TestResponse {
  const res = {
    _status: 200,
    _body: undefined as unknown,
    _headers: {} as Record<string, string>,
    statusCode: 200,

    status(code: number) {
      res._status = code;
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res._body = data;
      return res;
    },
    send(data: unknown) {
      res._body = data;
      return res;
    },
    setHeader(key: string, value: string) {
      res._headers[key] = value;
      return res;
    },
    getHeader(key: string) {
      return res._headers[key];
    },
  };
  return res as unknown as TestResponse;
}
