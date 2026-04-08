/** Contract: contracts/app/rules.md */

export interface HealthIndicator {
  name: string;
  value: number;
  unit?: string;
  status: 'ok' | 'warning' | 'critical';
  timestamp: string;
}

export interface OperationSummary {
  operation: string;
  count: number;
  avgDurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  errorCount: number;
}

export interface MetricsSummary {
  timestamp: string;
  uptime: number;
  health: HealthIndicator[];
  operations: OperationSummary[];
}

export interface AuditSummary {
  totalEntries: number;
  documentsTracked: number;
  lastEntryAt: string | null;
}

export function formatIndicatorName(name: string): string {
  return name
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatValue(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function latencyClass(ms: number): string {
  if (ms > 500) return 'ops-latency-critical';
  if (ms > 200) return 'ops-latency-warning';
  return '';
}

export function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
