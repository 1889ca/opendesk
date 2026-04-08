/** Contract: contracts/app-admin/rules.md */
import { describe, it, expect } from 'vitest';
import { countByStatus } from './health-panel.ts';
import type { HealthIndicator } from './admin-helpers.ts';

const INDICATORS: HealthIndicator[] = [
  { name: 'database.latency_ms', value: 5, unit: 'ms', status: 'ok', timestamp: '2026-04-08T12:00:00Z' },
  { name: 'database.pool_utilization', value: 85, unit: 'percent', status: 'warning', timestamp: '2026-04-08T12:00:00Z' },
  { name: 'process.heap_mb', value: 256, unit: 'mb', status: 'ok', timestamp: '2026-04-08T12:00:00Z' },
  { name: 'database.pool_waiting', value: 8, unit: 'connections', status: 'critical', timestamp: '2026-04-08T12:00:00Z' },
  { name: 'process.uptime_s', value: 3600, unit: 'seconds', status: 'ok', timestamp: '2026-04-08T12:00:00Z' },
];

describe('countByStatus', () => {
  it('counts indicators by status correctly', () => {
    const counts = countByStatus(INDICATORS);
    expect(counts.ok).toBe(3);
    expect(counts.warning).toBe(1);
    expect(counts.critical).toBe(1);
  });

  it('returns zero counts for empty array', () => {
    const counts = countByStatus([]);
    expect(counts.ok).toBe(0);
    expect(counts.warning).toBe(0);
    expect(counts.critical).toBe(0);
  });

  it('handles all-ok indicators', () => {
    const allOk: HealthIndicator[] = [
      { name: 'a', value: 1, status: 'ok', timestamp: '2026-04-08T12:00:00Z' },
      { name: 'b', value: 2, status: 'ok', timestamp: '2026-04-08T12:00:00Z' },
    ];
    const counts = countByStatus(allOk);
    expect(counts.ok).toBe(2);
    expect(counts.warning).toBe(0);
    expect(counts.critical).toBe(0);
  });

  it('handles all-critical indicators', () => {
    const allCrit: HealthIndicator[] = [
      { name: 'a', value: -1, status: 'critical', timestamp: '2026-04-08T12:00:00Z' },
      { name: 'b', value: -1, status: 'critical', timestamp: '2026-04-08T12:00:00Z' },
    ];
    const counts = countByStatus(allCrit);
    expect(counts.ok).toBe(0);
    expect(counts.critical).toBe(2);
  });
});
