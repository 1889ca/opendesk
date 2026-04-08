/** Contract: contracts/observability/rules.md */
import { describe, it, expect, vi } from 'vitest';
import { createTelemetryMiddleware, CORRELATION_HEADER } from './http-middleware.ts';
import type { ObservabilityModule } from '../contract.ts';

function makeMockObs(): ObservabilityModule {
  return {
    recordMetric: vi.fn(),
    getSummary: vi.fn(),
    getHealth: vi.fn(),
    startHealthMonitor: vi.fn(),
    stopHealthMonitor: vi.fn(),
  };
}

function makeMockReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: {},
    path: '/api/documents',
    method: 'GET',
    route: { path: '/documents' },
    principal: { id: 'user-1' },
    ...overrides,
  } as unknown as import('express').Request;
}

function makeMockRes() {
  const listeners: Record<string, (() => void)[]> = {};
  return {
    statusCode: 200,
    setHeader: vi.fn(),
    on(event: string, cb: () => void) {
      (listeners[event] ??= []).push(cb);
      return this;
    },
    _emit(event: string) {
      for (const cb of listeners[event] ?? []) cb();
    },
  } as unknown as import('express').Response & { _emit: (e: string) => void };
}

describe('telemetry middleware', () => {
  it('generates a correlation ID if not provided', () => {
    const obs = makeMockObs();
    const mw = createTelemetryMiddleware(obs, 1);
    const req = makeMockReq();
    const res = makeMockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      CORRELATION_HEADER,
      req.correlationId,
    );
  });

  it('preserves a valid incoming correlation ID', () => {
    const obs = makeMockObs();
    const mw = createTelemetryMiddleware(obs, 1);
    const existing = '550e8400-e29b-41d4-a716-446655440000';
    const req = makeMockReq({ headers: { [CORRELATION_HEADER]: existing } });
    const res = makeMockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(req.correlationId).toBe(existing);
  });

  it('records a metric on response finish', () => {
    const obs = makeMockObs();
    const mw = createTelemetryMiddleware(obs, 1);
    const req = makeMockReq();
    const res = makeMockRes();
    const next = vi.fn();

    mw(req, res, next);
    res._emit('finish');

    expect(obs.recordMetric).toHaveBeenCalledTimes(1);
    const metric = (obs.recordMetric as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(metric.service).toBe('api');
    expect(metric.operation).toBe('GET /documents');
    expect(metric.statusCode).toBe(200);
    expect(metric.actorId).toBe('user-1');
    expect(metric.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('skips non-API paths', () => {
    const obs = makeMockObs();
    const mw = createTelemetryMiddleware(obs, 1);
    const req = makeMockReq({ path: '/editor.html' });
    const res = makeMockRes();
    const next = vi.fn();

    mw(req, res, next);
    res._emit('finish');

    expect(obs.recordMetric).not.toHaveBeenCalled();
  });

  it('skips metrics endpoint to avoid feedback loops', () => {
    const obs = makeMockObs();
    const mw = createTelemetryMiddleware(obs, 1);
    const req = makeMockReq({ path: '/api/admin/metrics' });
    const res = makeMockRes();
    const next = vi.fn();

    mw(req, res, next);
    res._emit('finish');

    expect(obs.recordMetric).not.toHaveBeenCalled();
  });

  it('respects sample rate of 0', () => {
    const obs = makeMockObs();
    const mw = createTelemetryMiddleware(obs, 0);
    const req = makeMockReq();
    const res = makeMockRes();
    const next = vi.fn();

    mw(req, res, next);
    res._emit('finish');

    expect(obs.recordMetric).not.toHaveBeenCalled();
  });

  it('normalizes UUIDs in paths for aggregation', () => {
    const obs = makeMockObs();
    const mw = createTelemetryMiddleware(obs, 1);
    const req = makeMockReq({
      path: '/api/documents/550e8400-e29b-41d4-a716-446655440000/versions',
      route: { path: '/documents/550e8400-e29b-41d4-a716-446655440000/versions' },
    });
    const res = makeMockRes();
    const next = vi.fn();

    mw(req, res, next);
    res._emit('finish');

    const metric = (obs.recordMetric as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(metric.operation).toBe('GET /documents/:id/versions');
  });
});
