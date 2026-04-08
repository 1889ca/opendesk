/** Contract: contracts/sharing/rules.md */

import type { Redis } from 'ioredis';

/**
 * Redis-backed rate limiter for password attempts on share link resolution.
 * Uses INCR + EXPIRE for atomic, distributed rate tracking.
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

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_SECONDS = 60;
const KEY_PREFIX = 'opendesk:share-ratelimit:';

export type RateLimiterOptions = {
  maxAttempts?: number;
  windowSeconds?: number;
};

function redisKey(token: string): string {
  return `${KEY_PREFIX}${token}`;
}

/**
 * Create a Redis-backed password rate limiter with configurable thresholds.
 * Uses INCR + EXPIRE so entries auto-expire and scale across instances.
 */
export function createPasswordRateLimiter(
  redis: Redis,
  opts?: RateLimiterOptions,
): PasswordRateLimiter {
  const maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const windowSeconds = opts?.windowSeconds ?? DEFAULT_WINDOW_SECONDS;

  return {
    async check(token) {
      const key = redisKey(token);
      const current = await redis.get(key);
      if (current === null) return true;
      return parseInt(current, 10) < maxAttempts;
    },

    async record(token) {
      const key = redisKey(token);
      const count = await redis.incr(key);
      // Set expiry only on first attempt (when count transitions to 1)
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }
    },

    async reset(token) {
      const key = redisKey(token);
      await redis.del(key);
    },

    async disconnect() {
      // No-op: the shared Redis client lifecycle is managed externally
    },
  };
}

/**
 * In-memory rate limiter for tests (no Redis dependency).
 * Same interface, synchronous internals wrapped in Promises.
 */
export function createInMemoryPasswordRateLimiter(
  opts?: RateLimiterOptions,
): PasswordRateLimiter {
  const maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const windowMs = (opts?.windowSeconds ?? DEFAULT_WINDOW_SECONDS) * 1000;

  type Entry = { count: number; firstAttemptAt: number };
  const attempts = new Map<string, Entry>();

  function getEntry(token: string): Entry | null {
    const entry = attempts.get(token);
    if (!entry) return null;
    if (Date.now() - entry.firstAttemptAt > windowMs) {
      attempts.delete(token);
      return null;
    }
    return entry;
  }

  return {
    async check(token) {
      const entry = getEntry(token);
      if (!entry) return true;
      return entry.count < maxAttempts;
    },

    async record(token) {
      const entry = getEntry(token);
      if (entry) {
        entry.count += 1;
      } else {
        attempts.set(token, { count: 1, firstAttemptAt: Date.now() });
      }
    },

    async reset(token) {
      attempts.delete(token);
    },

    async disconnect() {
      attempts.clear();
    },
  };
}
