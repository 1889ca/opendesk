/** Contract: contracts/observability/rules.md */
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createMetricsRoutes } from './metrics-routes.ts';
import type { ObservabilityModule, MetricsSummary, HealthIndicator } from '../contract.ts';

function makeMockObs(overrides: Partial<ObservabilityModule> = {}): ObservabilityModule {
  const summary: MetricsSummary = {
    timestamp: '2026-04-07T22:00:00Z',
    uptime: 3600,
    health: [
      { name: 'database.latency_ms', value: 5, unit: 'ms', status: 'ok', timestamp: '2026-04-07T22:00:00Z' },
    ],
    operations: [
      { operation: 'GET /documents', count: 100, avgDurationMs: 12, p95DurationMs: 45, p99DurationMs: 89, errorCount: 2 },
    ],
  };

  return {
    recordMetric: vi.fn(),
    getSummary: vi.fn(async () => summary),
    getHealth: vi.fn(async () => summary.health),
    startHealthMonitor: vi.fn(),
    stopHealthMonitor: vi.fn(),
    getTimeSeries: vi.fn(async () => []),
    searchByCorrelationId: vi.fn(async () => []),
    ...overrides,
  };
}

function makeMockPermissions() {
  return {
    requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
      (_req as { principal?: unknown }).principal = { id: 'admin-1' };
      next();
    },
    require: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    grantStore: { findByPrincipal: vi.fn(async () => []) },
  } as unknown as import('../../permissions/index.ts').PermissionsModule;
}

describe('metrics routes', () => {
  it('GET / returns metrics summary', async () => {
    const obs = makeMockObs();
    const app = express();
    app.use('/api/admin/metrics', createMetricsRoutes({ observability: obs, permissions: makeMockPermissions(), pool: {} as never }));

    const res = await request(app).get('/api/admin/metrics');

    expect(res.status).toBe(200);
    expect(res.body.uptime).toBe(3600);
    expect(res.body.operations).toHaveLength(1);
    expect(res.body.operations[0].operation).toBe('GET /documents');
    expect(res.body.health).toHaveLength(1);
  });

  it('GET /health returns health indicators', async () => {
    const obs = makeMockObs();
    const app = express();
    app.use('/api/admin/metrics', createMetricsRoutes({ observability: obs, permissions: makeMockPermissions(), pool: {} as never }));

    const res = await request(app).get('/api/admin/metrics/health');

    expect(res.status).toBe(200);
    expect(res.body.indicators).toHaveLength(1);
    expect(res.body.indicators[0].name).toBe('database.latency_ms');
    expect(res.body.indicators[0].status).toBe('ok');
  });
});
