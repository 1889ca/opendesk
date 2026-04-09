/** Contract: contracts/sharing/rules.md */
import { describe, it, expect } from 'vitest';
import {
  createInMemoryPasswordRateLimiter,
  createInMemoryShareResolveRateLimiter,
} from './rate-limit.ts';

// Issue #135: the share-resolve limiter is keyed by source IP, not
// token, so token enumeration can't bypass it. Both limiters share
// an underlying window engine — this suite covers both shapes.

describe('createInMemoryPasswordRateLimiter (per-token)', () => {
  it('allows attempts up to maxAttempts within the window', async () => {
    const rl = createInMemoryPasswordRateLimiter({ maxAttempts: 3, windowSeconds: 60 });

    expect(await rl.check('token-a')).toBe(true);
    await rl.record('token-a');
    expect(await rl.check('token-a')).toBe(true);
    await rl.record('token-a');
    expect(await rl.check('token-a')).toBe(true);
    await rl.record('token-a');
    // Now at the limit.
    expect(await rl.check('token-a')).toBe(false);
  });

  it('isolates buckets per token', async () => {
    const rl = createInMemoryPasswordRateLimiter({ maxAttempts: 1, windowSeconds: 60 });

    await rl.record('token-a');
    expect(await rl.check('token-a')).toBe(false);
    expect(await rl.check('token-b')).toBe(true);
  });

  it('reset clears the bucket for a token', async () => {
    const rl = createInMemoryPasswordRateLimiter({ maxAttempts: 1, windowSeconds: 60 });

    await rl.record('token-a');
    expect(await rl.check('token-a')).toBe(false);
    await rl.reset('token-a');
    expect(await rl.check('token-a')).toBe(true);
  });
});

describe('createInMemoryShareResolveRateLimiter (per-IP, issue #135)', () => {
  it('allows attempts up to maxAttempts per source IP', async () => {
    const rl = createInMemoryShareResolveRateLimiter({ maxAttempts: 3, windowSeconds: 60 });

    expect(await rl.check('1.2.3.4')).toBe(true);
    await rl.record('1.2.3.4');
    await rl.record('1.2.3.4');
    await rl.record('1.2.3.4');
    expect(await rl.check('1.2.3.4')).toBe(false);
  });

  it('caps token enumeration: many DIFFERENT tokens still hit the per-IP cap', async () => {
    // The crux of #135. Each call uses a different "token" but they
    // all come from the same IP, so the per-IP limiter eventually
    // refuses regardless of token uniqueness.
    const rl = createInMemoryShareResolveRateLimiter({ maxAttempts: 5, windowSeconds: 60 });
    const ip = '203.0.113.7';

    for (let i = 0; i < 5; i++) {
      expect(await rl.check(ip)).toBe(true);
      await rl.record(ip);
    }
    expect(await rl.check(ip)).toBe(false);
  });

  it('isolates buckets per IP', async () => {
    const rl = createInMemoryShareResolveRateLimiter({ maxAttempts: 1, windowSeconds: 60 });

    await rl.record('1.2.3.4');
    expect(await rl.check('1.2.3.4')).toBe(false);
    expect(await rl.check('5.6.7.8')).toBe(true);
  });

  it('uses sensible defaults (20 attempts / 60s) when no opts given', async () => {
    const rl = createInMemoryShareResolveRateLimiter();
    const ip = '198.51.100.42';

    for (let i = 0; i < 20; i++) {
      expect(await rl.check(ip)).toBe(true);
      await rl.record(ip);
    }
    expect(await rl.check(ip)).toBe(false);
  });
});
