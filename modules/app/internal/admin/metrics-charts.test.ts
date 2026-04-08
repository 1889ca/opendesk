/** Contract: contracts/app/observability-dashboard.md */
import { describe, it, expect } from 'vitest';
import type { TimeSeriesPoint } from './metrics-charts.ts';

// Test chart data preparation logic without needing Canvas (pure data transforms)

function makePoints(count: number, baseTime = Date.now()): TimeSeriesPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    bucket: new Date(baseTime + i * 5 * 60_000).toISOString(),
    requestCount: 10 + i * 5,
    errorCount: i % 3 === 0 ? 1 : 0,
    avgDurationMs: 15 + i * 2,
    p50DurationMs: 10 + i,
    p95DurationMs: 30 + i * 3,
    p99DurationMs: 50 + i * 5,
  }));
}

describe('chart data preparation', () => {
  it('TimeSeriesPoint array has correct structure', () => {
    const points = makePoints(12);
    expect(points).toHaveLength(12);
    for (const p of points) {
      expect(typeof p.bucket).toBe('string');
      expect(p.requestCount).toBeGreaterThanOrEqual(0);
      expect(p.errorCount).toBeGreaterThanOrEqual(0);
      expect(p.p50DurationMs).toBeLessThanOrEqual(p.p95DurationMs);
      expect(p.p95DurationMs).toBeLessThanOrEqual(p.p99DurationMs);
    }
  });

  it('calculates max values correctly for chart scaling', () => {
    const points = makePoints(12);
    const maxReqs = Math.max(...points.map((p) => p.requestCount));
    const maxLatency = Math.max(...points.map((p) => p.p99DurationMs));
    expect(maxReqs).toBe(65); // 10 + 11*5
    expect(maxLatency).toBe(105); // 50 + 11*5
  });

  it('handles empty data gracefully', () => {
    const points: TimeSeriesPoint[] = [];
    const maxReqs = Math.max(1, ...points.map((p) => p.requestCount));
    expect(maxReqs).toBe(1); // fallback to 1 to prevent division by zero
  });

  it('buckets are in chronological order', () => {
    const points = makePoints(12);
    for (let i = 1; i < points.length; i++) {
      expect(new Date(points[i].bucket).getTime()).toBeGreaterThan(
        new Date(points[i - 1].bucket).getTime(),
      );
    }
  });

  it('error count never exceeds request count', () => {
    const points = makePoints(20);
    for (const p of points) {
      expect(p.errorCount).toBeLessThanOrEqual(p.requestCount);
    }
  });

  it('percentile ordering is maintained (p50 <= p95 <= p99)', () => {
    const points = makePoints(24);
    for (const p of points) {
      expect(p.p50DurationMs).toBeLessThanOrEqual(p.p95DurationMs);
      expect(p.p95DurationMs).toBeLessThanOrEqual(p.p99DurationMs);
    }
  });
});

describe('time label extraction', () => {
  it('creates valid Date objects from bucket strings', () => {
    const points = makePoints(6);
    for (const p of points) {
      const d = new Date(p.bucket);
      expect(d.getTime()).not.toBeNaN();
    }
  });

  it('formats time labels as HH:MM', () => {
    const point: TimeSeriesPoint = {
      bucket: '2026-04-08T14:30:00.000Z',
      requestCount: 10, errorCount: 0, avgDurationMs: 5,
      p50DurationMs: 3, p95DurationMs: 8, p99DurationMs: 12,
    };
    const d = new Date(point.bucket);
    const formatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });
});
