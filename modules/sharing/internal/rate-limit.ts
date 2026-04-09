/** Contract: contracts/sharing/rules.md */

import type { Redis } from 'ioredis';

/**
 * Redis-backed rate limiters for share-link traffic. Two distinct
 * limiters are factored from the same generic engine:
 *
 * 1. Password rate limiter — keyed by token, tracks failed password
 *    attempts on a known token. 5 attempts per 60 seconds per token.
 *
 * 2. Resolve rate limiter — keyed by source IP, slows blind token
 *    enumeration on POST /api/share/:token/resolve (issue #135).
 *    20 attempts per 60 seconds per IP.
 *
 * Both use INCR + EXPIRE on Redis for atomic, distributed tracking.
 */

export type PasswordRateLimiter = {
  /** Check if a new attempt is allowed for this token. */
  check(token: string): Promise<boolean>;
  /** Record a failed password attempt. */
  record(token: string): Promise<void>;
  /** Reset attempts for a token (e.g. on successful resolution). */
  reset(token: string): Promise<void>;
  /** Disconnect the underlying client (for graceful shutdown). */
  disconnect(): Promise<void>;
};

/** Same shape as PasswordRateLimiter, but the keys are IPs not tokens. */
export type ShareResolveRateLimiter = PasswordRateLimiter;

const DEFAULT_PASSWORD_MAX_ATTEMPTS = 5;
const DEFAULT_PASSWORD_WINDOW_SECONDS = 60;
const PASSWORD_KEY_PREFIX = 'opendesk:share-ratelimit:';

const DEFAULT_RESOLVE_MAX_ATTEMPTS = 20;
const DEFAULT_RESOLVE_WINDOW_SECONDS = 60;
const RESOLVE_KEY_PREFIX = 'opendesk:share-resolve-ratelimit:';

export type RateLimiterOptions = {
  maxAttempts?: number;
  windowSeconds?: number;
};

/**
 * Generic Redis-backed window rate limiter. Both share-link limiters
 * close over a key prefix and threshold pair so we don't duplicate
 * the INCR + EXPIRE logic.
 */
function createWindowRateLimiter(
  redis: Redis,
  keyPrefix: string,
  maxAttempts: number,
  windowSeconds: number,
): PasswordRateLimiter {
  function redisKey(id: string): string {
    return `${keyPrefix}${id}`;
  }

  return {
    async check(id) {
      const key = redisKey(id);
      const current = await redis.get(key);
      if (current === null) return true;
      return parseInt(current, 10) < maxAttempts;
    },

    async record(id) {
      const key = redisKey(id);
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }
    },

    async reset(id) {
      const key = redisKey(id);
      await redis.del(key);
    },

    async disconnect() {
      // No-op: the shared Redis client lifecycle is managed externally.
    },
  };
}

/** Password attempts limiter — keyed by share-link token. */
export function createPasswordRateLimiter(
  redis: Redis,
  opts?: RateLimiterOptions,
): PasswordRateLimiter {
  return createWindowRateLimiter(
    redis,
    PASSWORD_KEY_PREFIX,
    opts?.maxAttempts ?? DEFAULT_PASSWORD_MAX_ATTEMPTS,
    opts?.windowSeconds ?? DEFAULT_PASSWORD_WINDOW_SECONDS,
  );
}

/**
 * Resolve attempts limiter — keyed by source IP (issue #135).
 *
 * The password limiter is keyed by token so token enumeration
 * (trying random tokens to find one that exists) bypasses it
 * entirely. This second limiter caps total resolve attempts per IP
 * regardless of which token is being tried.
 */
export function createShareResolveRateLimiter(
  redis: Redis,
  opts?: RateLimiterOptions,
): ShareResolveRateLimiter {
  return createWindowRateLimiter(
    redis,
    RESOLVE_KEY_PREFIX,
    opts?.maxAttempts ?? DEFAULT_RESOLVE_MAX_ATTEMPTS,
    opts?.windowSeconds ?? DEFAULT_RESOLVE_WINDOW_SECONDS,
  );
}

/**
 * In-memory rate limiter for tests (no Redis dependency).
 * Same interface, synchronous internals wrapped in Promises.
 */
function createInMemoryRateLimiter(
  maxAttempts: number,
  windowSeconds: number,
): PasswordRateLimiter {
  const windowMs = windowSeconds * 1000;

  type Entry = { count: number; firstAttemptAt: number };
  const attempts = new Map<string, Entry>();

  function getEntry(id: string): Entry | null {
    const entry = attempts.get(id);
    if (!entry) return null;
    if (Date.now() - entry.firstAttemptAt > windowMs) {
      attempts.delete(id);
      return null;
    }
    return entry;
  }

  return {
    async check(id) {
      const entry = getEntry(id);
      if (!entry) return true;
      return entry.count < maxAttempts;
    },

    async record(id) {
      const entry = getEntry(id);
      if (entry) {
        entry.count += 1;
      } else {
        attempts.set(id, { count: 1, firstAttemptAt: Date.now() });
      }
    },

    async reset(id) {
      attempts.delete(id);
    },

    async disconnect() {
      attempts.clear();
    },
  };
}

/** In-memory password rate limiter — keyed by token. */
export function createInMemoryPasswordRateLimiter(
  opts?: RateLimiterOptions,
): PasswordRateLimiter {
  return createInMemoryRateLimiter(
    opts?.maxAttempts ?? DEFAULT_PASSWORD_MAX_ATTEMPTS,
    opts?.windowSeconds ?? DEFAULT_PASSWORD_WINDOW_SECONDS,
  );
}

/** In-memory share-resolve rate limiter — keyed by source IP. */
export function createInMemoryShareResolveRateLimiter(
  opts?: RateLimiterOptions,
): ShareResolveRateLimiter {
  return createInMemoryRateLimiter(
    opts?.maxAttempts ?? DEFAULT_RESOLVE_MAX_ATTEMPTS,
    opts?.windowSeconds ?? DEFAULT_RESOLVE_WINDOW_SECONDS,
  );
}
