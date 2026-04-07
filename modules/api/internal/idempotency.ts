/** Contract: contracts/api/rules.md */
import type { Request, Response, NextFunction } from 'express';
import type { CacheClient } from './redis.ts';

/** 24 hours in seconds, per collab contract idempotency cache requirement. */
export const IDEMPOTENCY_TTL_SECONDS = 86_400;

/** Prefix for idempotency cache keys. */
export const IDEMPOTENCY_KEY_PREFIX = 'idem:';

export interface CachedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/** Build the cache key from the request method, path, and idempotency key header. */
export function buildCacheKey(method: string, path: string, idempotencyKey: string): string {
  return `${IDEMPOTENCY_KEY_PREFIX}${method}:${path}:${idempotencyKey}`;
}

/** Serialize a response for caching. */
export function serializeResponse(statusCode: number, headers: Record<string, string>, body: string): string {
  const cached: CachedResponse = { statusCode, headers, body };
  return JSON.stringify(cached);
}

/** Deserialize a cached response. */
export function deserializeResponse(raw: string): CachedResponse {
  return JSON.parse(raw) as CachedResponse;
}

export interface IdempotencyOptions {
  cache: CacheClient;
  ttlSeconds?: number;
  /** HTTP methods to apply idempotency to. Default: POST, PUT, DELETE */
  methods?: string[];
  headerName?: string;
}

/**
 * Express middleware that enforces idempotency via `Idempotency-Key` header.
 *
 * For mutating requests (POST/PUT/DELETE by default):
 * - If the header is present and a cached response exists, returns the cached response immediately.
 * - If the header is present and no cache exists, intercepts the response, caches it, then sends it.
 * - If the header is missing on a mutating request, returns 400.
 */
export function idempotencyMiddleware(options: IdempotencyOptions) {
  const {
    cache,
    ttlSeconds = IDEMPOTENCY_TTL_SECONDS,
    methods = ['POST', 'PUT', 'DELETE'],
    headerName = 'idempotency-key',
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const method = req.method.toUpperCase();

    // Only apply to configured methods
    if (!methods.includes(method)) {
      next();
      return;
    }

    const idempotencyKey = req.headers[headerName] as string | undefined;

    // Require header on mutating endpoints
    if (!idempotencyKey) {
      res.status(400).json({
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: `${headerName} header is required for ${method} requests`,
      });
      return;
    }

    const cacheKey = buildCacheKey(method, req.path, idempotencyKey);

    // Check cache for existing response
    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        const { statusCode, headers, body } = deserializeResponse(cached);
        for (const [key, value] of Object.entries(headers)) {
          res.setHeader(key, value);
        }
        res.setHeader('X-Idempotent-Replayed', 'true');
        res.status(statusCode).send(body);
        return;
      }
    } catch (err) {
      // Cache read failure is non-fatal — proceed without idempotency
      console.error('[idempotency] cache read error:', err);
    }

    // Intercept the response to cache it
    interceptResponse(res, cache, cacheKey, ttlSeconds);
    next();
  };
}

/**
 * Monkey-patches res.json and res.send to capture the response for caching.
 * After the first response is sent, it's stored in Redis with the configured TTL.
 */
function interceptResponse(
  res: Response,
  cache: CacheClient,
  cacheKey: string,
  ttlSeconds: number,
): void {
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  let captured = false;

  const captureAndCache = (body: string) => {
    if (captured) return;
    captured = true;

    // Only cache successful or expected error responses (2xx, 4xx)
    const status = res.statusCode;
    if (status >= 200 && status < 500) {
      const headers: Record<string, string> = {};
      const contentType = res.getHeader('content-type');
      if (contentType) headers['content-type'] = String(contentType);

      const serialized = serializeResponse(status, headers, body);
      cache.set(cacheKey, serialized, 'EX', ttlSeconds).catch((err) => {
        console.error('[idempotency] cache write error:', err);
      });
    }
  };

  res.json = function patchedJson(data: unknown) {
    const body = JSON.stringify(data);
    captureAndCache(body);
    return originalJson(data);
  } as typeof res.json;

  res.send = function patchedSend(data: unknown) {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    captureAndCache(body);
    return originalSend(data);
  } as typeof res.send;
}
