/** Contract: contracts/app-admin/rules.md */
import type { MetricsSummary, OperationSummary, HealthIndicator } from './admin-helpers.ts';

export interface ComplianceReport {
  generatedAt: string;
  uptime: number;
  totalRequests: number;
  totalErrors: number;
  errorRate: string;
  healthIndicators: Array<{ name: string; status: string; value: number; unit: string }>;
  endpoints: Array<{
    operation: string;
    count: number;
    avgMs: number;
    p95Ms: number;
    p99Ms: number;
    errors: number;
    errorRate: string;
  }>;
}

/** Build a compliance report from a MetricsSummary. */
export function buildComplianceReport(summary: MetricsSummary): ComplianceReport {
  const totalRequests = summary.operations.reduce((s, op) => s + op.count, 0);
  const totalErrors = summary.operations.reduce((s, op) => s + op.errorCount, 0);

  return {
    generatedAt: new Date().toISOString(),
    uptime: summary.uptime,
    totalRequests,
    totalErrors,
    errorRate: totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) + '%' : '0%',
    healthIndicators: summary.health.map((h) => ({
      name: h.name,
      status: h.status,
      value: h.value,
      unit: h.unit ?? '',
    })),
    endpoints: summary.operations.map((op) => ({
      operation: op.operation,
      count: op.count,
      avgMs: op.avgDurationMs,
      p95Ms: op.p95DurationMs,
      p99Ms: op.p99DurationMs,
      errors: op.errorCount,
      errorRate: op.count > 0 ? ((op.errorCount / op.count) * 100).toFixed(2) + '%' : '0%',
    })),
  };
}

/** Convert compliance report to CSV string. */
export function reportToCSV(report: ComplianceReport): string {
  const lines: string[] = [];

  lines.push('OpenDesk Compliance Evidence Report');
  lines.push(`Generated,${report.generatedAt}`);
  lines.push(`Uptime (s),${report.uptime}`);
  lines.push(`Total Requests,${report.totalRequests}`);
  lines.push(`Total Errors,${report.totalErrors}`);
  lines.push(`Error Rate,${report.errorRate}`);
  lines.push('');

  lines.push('Health Indicators');
  lines.push('Name,Status,Value,Unit');
  for (const h of report.healthIndicators) {
    lines.push(`${csvEscape(h.name)},${h.status},${h.value},${h.unit}`);
  }
  lines.push('');

  lines.push('Endpoint Metrics');
  lines.push('Operation,Requests,Avg (ms),P95 (ms),P99 (ms),Errors,Error Rate');
  for (const ep of report.endpoints) {
    lines.push(
      `${csvEscape(ep.operation)},${ep.count},${ep.avgMs},${ep.p95Ms},${ep.p99Ms},${ep.errors},${ep.errorRate}`,
    );
  }

  return lines.join('\n');
}

/** Convert compliance report to a downloadable JSON string. */
export function reportToJSON(report: ComplianceReport): string {
  return JSON.stringify(report, null, 2);
}

/** Trigger a file download in the browser. */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Escape a CSV field value. */
function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/** Render compliance export controls. */
export function renderComplianceControls(container: HTMLElement, summary: MetricsSummary): void {
  container.innerHTML = '';

  const csvBtn = document.createElement('button');
  csvBtn.className = 'btn btn-secondary';
  csvBtn.textContent = 'Export CSV';
  csvBtn.addEventListener('click', () => {
    const report = buildComplianceReport(summary);
    const csv = reportToCSV(report);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    downloadFile(csv, `opendesk-compliance-${ts}.csv`, 'text/csv');
  });

  const jsonBtn = document.createElement('button');
  jsonBtn.className = 'btn btn-secondary';
  jsonBtn.textContent = 'Export JSON';
  jsonBtn.addEventListener('click', () => {
    const report = buildComplianceReport(summary);
    const json = reportToJSON(report);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    downloadFile(json, `opendesk-compliance-${ts}.json`, 'application/json');
  });

  container.append(csvBtn, jsonBtn);
}
