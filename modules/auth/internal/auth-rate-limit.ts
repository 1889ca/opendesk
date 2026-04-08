/** Contract: contracts/auth/rules.md */

import type { Redis } from 'ioredis';

/**
 * Redis-backed rate limiter for failed authentication attempts per IP.
 * Tracks 401 responses and blocks further attempts when threshold exceeded.
 * Uses INCR + EXPIRE for atomic, distributed rate tracking.
 */

export type AuthRateLimiter = {
  /** Check if a new auth attempt is allowed for this IP. */
  check(ip: string): Promise<boolean>;
  /** Record a failed authentication attempt. */
  recordFailure(ip: string): Promise<void>;
};

const DEFAULT_MAX_FAILURES = 10;
const DEFAULT_WINDOW_SECONDS = 15 * 60; // 15 minutes
const KEY_PREFIX = 'opendesk:auth-ratelimit:';

export type AuthRateLimiterOptions = {
  maxFailures?: number;
  windowSeconds?: number;
};

function redisKey(ip: string): string {
  return `${KEY_PREFIX}${ip}`;
}

/**
 * Create a Redis-backed auth failure rate limiter.
 * 10 failed attempts per 15 minutes per IP (configurable).
 */
export function createAuthRateLimiter(
  redis: Redis,
  opts?: AuthRateLimiterOptions,
): AuthRateLimiter {
  const maxFailures = opts?.maxFailures ?? DEFAULT_MAX_FAILURES;
  const windowSeconds = opts?.windowSeconds ?? DEFAULT_WINDOW_SECONDS;

  return {
    async check(ip) {
      const key = redisKey(ip);
      const current = await redis.get(key);
      if (current === null) return true;
      return parseInt(current, 10) < maxFailures;
    },

    async recordFailure(ip) {
      const key = redisKey(ip);
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }
    },
  };
}

/**
 * In-memory auth rate limiter for tests (no Redis dependency).
 */
export function createInMemoryAuthRateLimiter(
  opts?: AuthRateLimiterOptions,
): AuthRateLimiter {
  const maxFailures = opts?.maxFailures ?? DEFAULT_MAX_FAILURES;
  const windowMs = (opts?.windowSeconds ?? DEFAULT_WINDOW_SECONDS) * 1000;

  type Entry = { count: number; firstAttemptAt: number };
  const attempts = new Map<string, Entry>();

  function getEntry(ip: string): Entry | null {
    const entry = attempts.get(ip);
    if (!entry) return null;
    if (Date.now() - entry.firstAttemptAt > windowMs) {
      attempts.delete(ip);
      return null;
    }
    return entry;
  }

  return {
    async check(ip) {
      const entry = getEntry(ip);
      if (!entry) return true;
      return entry.count < maxFailures;
    },

    async recordFailure(ip) {
      const entry = getEntry(ip);
      if (entry) {
        entry.count += 1;
      } else {
        attempts.set(ip, { count: 1, firstAttemptAt: Date.now() });
      }
    },
  };
}
