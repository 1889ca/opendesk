/** Contract: contracts/app-admin/rules.md */
import { describe, it, expect } from 'vitest';
import { buildComplianceReport, reportToCSV, reportToJSON } from './compliance-export.ts';
import type { MetricsSummary } from './admin-helpers.ts';

const SUMMARY: MetricsSummary = {
  timestamp: '2026-04-08T12:00:00Z',
  uptime: 86400,
  health: [
    { name: 'database.latency_ms', value: 5.2, unit: 'ms', status: 'ok', timestamp: '2026-04-08T12:00:00Z' },
    { name: 'process.heap_mb', value: 256, unit: 'mb', status: 'ok', timestamp: '2026-04-08T12:00:00Z' },
    { name: 'database.pool_utilization', value: 85, unit: 'percent', status: 'warning', timestamp: '2026-04-08T12:00:00Z' },
  ],
  operations: [
    { operation: 'GET /documents', count: 500, avgDurationMs: 12.5, p95DurationMs: 45.0, p99DurationMs: 89.0, errorCount: 3 },
    { operation: 'POST /documents', count: 100, avgDurationMs: 35.0, p95DurationMs: 120.0, p99DurationMs: 250.0, errorCount: 0 },
    { operation: 'DELETE /documents/:id', count: 10, avgDurationMs: 8.0, p95DurationMs: 15.0, p99DurationMs: 20.0, errorCount: 1 },
  ],
};

describe('buildComplianceReport', () => {
  it('calculates total requests and errors correctly', () => {
    const report = buildComplianceReport(SUMMARY);
    expect(report.totalRequests).toBe(610);
    expect(report.totalErrors).toBe(4);
  });

  it('calculates overall error rate', () => {
    const report = buildComplianceReport(SUMMARY);
    expect(report.errorRate).toBe('0.66%');
  });

  it('includes all health indicators', () => {
    const report = buildComplianceReport(SUMMARY);
    expect(report.healthIndicators).toHaveLength(3);
    expect(report.healthIndicators[0].name).toBe('database.latency_ms');
    expect(report.healthIndicators[2].status).toBe('warning');
  });

  it('includes per-endpoint error rates', () => {
    const report = buildComplianceReport(SUMMARY);
    expect(report.endpoints[0].errorRate).toBe('0.60%');
    expect(report.endpoints[1].errorRate).toBe('0.00%');
    expect(report.endpoints[2].errorRate).toBe('10.00%');
  });

  it('handles zero-request summary without division error', () => {
    const empty: MetricsSummary = { timestamp: '2026-04-08T12:00:00Z', uptime: 0, health: [], operations: [] };
    const report = buildComplianceReport(empty);
    expect(report.totalRequests).toBe(0);
    expect(report.errorRate).toBe('0%');
  });
});

describe('reportToCSV', () => {
  it('generates valid CSV with correct headers and data', () => {
    const report = buildComplianceReport(SUMMARY);
    const csv = reportToCSV(report);
    expect(csv).toContain('OpenDesk Compliance Evidence Report');
    expect(csv).toContain('Total Requests,610');
    expect(csv).toContain('Total Errors,4');
    expect(csv).toContain('Name,Status,Value,Unit');
    expect(csv).toContain('database.latency_ms,ok,5.2,ms');
    expect(csv).toContain('Operation,Requests,Avg (ms),P95 (ms),P99 (ms),Errors,Error Rate');
    expect(csv).toContain('GET /documents,500,12.5,45,89,3,0.60%');
  });

  it('escapes CSV fields with commas', () => {
    const summary: MetricsSummary = {
      ...SUMMARY,
      operations: [
        { operation: 'GET /search?q=a,b', count: 1, avgDurationMs: 5, p95DurationMs: 10, p99DurationMs: 15, errorCount: 0 },
      ],
    };
    const csv = reportToCSV(buildComplianceReport(summary));
    expect(csv).toContain('"GET /search?q=a,b"');
  });
});

describe('reportToJSON', () => {
  it('generates valid JSON that round-trips', () => {
    const report = buildComplianceReport(SUMMARY);
    const json = reportToJSON(report);
    const parsed = JSON.parse(json);
    expect(parsed.totalRequests).toBe(610);
    expect(parsed.endpoints).toHaveLength(3);
  });
});
