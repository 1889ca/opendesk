/** Contract: contracts/observability/rules.md */
import { describe, it, expect, vi } from 'vitest';
import { createObservability } from './create-observability.ts';

function makeMockPool() {
  return {
    query: vi.fn(async () => ({ rows: [] })),
    totalCount: 10,
    idleCount: 8,
    waitingCount: 0,
  } as unknown as import('pg').Pool;
}

describe('createObservability', () => {
  it('returns an ObservabilityModule with all methods', () => {
    const obs = createObservability({ pool: makeMockPool() });

    expect(obs.recordMetric).toBeTypeOf('function');
    expect(obs.getSummary).toBeTypeOf('function');
    expect(obs.getHealth).toBeTypeOf('function');
    expect(obs.startHealthMonitor).toBeTypeOf('function');
    expect(obs.stopHealthMonitor).toBeTypeOf('function');
  });

  it('recordMetric does not throw on pool error', () => {
    const pool = makeMockPool();
    pool.query = vi.fn(async () => { throw new Error('pool dead'); });
    const obs = createObservability({ pool });

    // Should not throw — fire-and-forget
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
  });

  it('getSummary returns a valid shape', async () => {
    const obs = createObservability({ pool: makeMockPool() });
    const summary = await obs.getSummary();

    expect(summary.timestamp).toBeDefined();
    expect(summary.uptime).toBeGreaterThanOrEqual(0);
    expect(summary.health).toBeInstanceOf(Array);
    expect(summary.operations).toBeInstanceOf(Array);
  });
});
