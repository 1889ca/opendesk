/** Contract: contracts/observability/rules.md */
import { describe, it, expect } from 'vitest';
import pg from 'pg';
import { createObservability } from './create-observability.ts';
import { describeIntegration } from '../../../tests/integration/test-pg.ts';

// Issue #127: previously this test mocked pg.Pool with vi.fn(). The
// new version splits into:
//   - "shape" — pure factory assertions, using a real pg.Pool
//     pointed at a closed port (the constructor doesn't query)
//   - "fire-and-forget" — same closed-port pool, exercised through
//     the real adapter to drive the failure path
//   - "integration" — runs against the real test Postgres for the
//     getSummary happy path

describe('createObservability — factory shape (unit)', () => {
  // The factory just constructs an object; we can hand it a real
  // pg.Pool with a config that doesn't connect on init. .query()
  // fails later when actually invoked, but the constructor itself
  // doesn't query.
  function buildPoolStub(): pg.Pool {
    return new pg.Pool({
      host: '127.0.0.1',
      port: 1, // closed port — any later query will reject
      database: 'opendesk',
      user: 'opendesk',
      password: 'opendesk_dev',
      connectionTimeoutMillis: 200,
    });
  }

  it('returns an ObservabilityModule with all expected methods', () => {
    const pool = buildPoolStub();
    try {
      const obs = createObservability({ pool });
      expect(obs.recordMetric).toBeTypeOf('function');
      expect(obs.getSummary).toBeTypeOf('function');
      expect(obs.getHealth).toBeTypeOf('function');
      expect(obs.startHealthMonitor).toBeTypeOf('function');
      expect(obs.stopHealthMonitor).toBeTypeOf('function');
    } finally {
      void pool.end();
    }
  });

  it('recordMetric is fire-and-forget — does not throw when the pool is unreachable', async () => {
    const pool = buildPoolStub();
    try {
      const obs = createObservability({ pool });
      expect(() =>
        obs.recordMetric({
          correlationId: '550e8400-e29b-41d4-a716-446655440000',
          service: 'api',
          operation: 'GET /test',
          durationMs: 42,
          statusCode: 200,
          tags: {},
        }),
      ).not.toThrow();
      // Give the unhandled promise a moment to reject internally
      // before the test ends — we want to prove the rejection is
      // swallowed by the module, not surfaced.
      await new Promise((resolve) => setTimeout(resolve, 50));
    } finally {
      void pool.end();
    }
  });
});

describeIntegration('createObservability — getSummary (integration)', (ctx) => {
  it('returns a valid MetricsSummary shape against real Postgres', async () => {
    if (!ctx.pool) return;

    const obs = createObservability({ pool: ctx.pool });
    const summary = await obs.getSummary();

    expect(summary.timestamp).toBeDefined();
    expect(summary.uptime).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(summary.health)).toBe(true);
    expect(Array.isArray(summary.operations)).toBe(true);
  });
});
