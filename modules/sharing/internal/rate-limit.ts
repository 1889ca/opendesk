/** Contract: contracts/sharing/rules.md */

/**
 * In-memory rate limiter for password attempts on share link resolution.
 * Tracks failed attempts per token and blocks after a threshold.
 */

export type PasswordRateLimiter = {
  /** Check if a new attempt is allowed for this token. */
  check(token: string): boolean;
  /** Record a failed password attempt. */
  record(token: string): void;
  /** Reset attempts for a token (e.g. on successful resolution). */
  reset(token: string): void;
};

type AttemptEntry = {
  count: number;
  firstAttemptAt: number;
};

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MS = 60_000; // 1 minute

export type RateLimiterOptions = {
  maxAttempts?: number;
  windowMs?: number;
};

/**
 * Create a password rate limiter with configurable thresholds.
 * Entries auto-expire after the window elapses.
 */
export function createPasswordRateLimiter(opts?: RateLimiterOptions): PasswordRateLimiter {
  const maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
  const attempts = new Map<string, AttemptEntry>();

  function getEntry(token: string): AttemptEntry | null {
    const entry = attempts.get(token);
    if (!entry) return null;
    if (Date.now() - entry.firstAttemptAt > windowMs) {
      attempts.delete(token);
      return null;
    }
    return entry;
  }

  return {
    check(token) {
      const entry = getEntry(token);
      if (!entry) return true;
      return entry.count < maxAttempts;
    },

    record(token) {
      const entry = getEntry(token);
      if (entry) {
        entry.count += 1;
      } else {
        attempts.set(token, { count: 1, firstAttemptAt: Date.now() });
      }
    },

    reset(token) {
      attempts.delete(token);
    },
  };
}
