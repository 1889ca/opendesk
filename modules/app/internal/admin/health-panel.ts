/** Contract: contracts/app/observability-dashboard.md */
import {
  formatIndicatorName, formatValue, escapeHtml, latencyClass,
  type HealthIndicator, type OperationSummary,
} from '../admin-helpers.ts';

const STATUS_COLORS: Record<string, string> = {
  ok: 'var(--connected, #22c55e)',
  warning: 'var(--accent, #f59e0b)',
  critical: 'var(--disconnected, #ef4444)',
};

/** Render a grid of health indicator cards with status badges. */
export function renderHealthPanel(container: HTMLElement, indicators: HealthIndicator[]): void {
  container.innerHTML = '';

  if (indicators.length === 0) {
    container.innerHTML = '<div class="admin-empty">No health data yet. Probes run every 60s.</div>';
    return;
  }

  for (const ind of indicators) {
    const card = document.createElement('div');
    card.className = `health-card health-${ind.status}`;

    const dot = document.createElement('span');
    dot.className = 'health-dot';
    dot.style.background = STATUS_COLORS[ind.status] ?? STATUS_COLORS.ok;

    const label = document.createElement('span');
    label.className = 'health-label';
    label.textContent = formatIndicatorName(ind.name);

    const value = document.createElement('span');
    value.className = 'health-value';
    value.textContent = ind.value === -1
      ? 'UNAVAILABLE'
      : `${formatValue(ind.value)} ${ind.unit ?? ''}`.trim();

    const status = document.createElement('span');
    status.className = `health-status health-status-${ind.status}`;
    status.textContent = ind.status.toUpperCase();

    card.append(dot, label, value, status);
    container.appendChild(card);
  }
}

/** Count indicators by status. */
export function countByStatus(
  indicators: HealthIndicator[],
): { ok: number; warning: number; critical: number } {
  const counts = { ok: 0, warning: 0, critical: 0 };
  for (const ind of indicators) {
    counts[ind.status] = (counts[ind.status] ?? 0) + 1;
  }
  return counts;
}

/** Render the operations summary table. */
export function renderOperationsTable(container: HTMLElement, operations: OperationSummary[]): void {
  container.innerHTML = '';
  if (operations.length === 0) {
    container.innerHTML = '<div class="admin-empty">No request metrics yet.</div>';
    return;
  }
  const table = document.createElement('table');
  table.className = 'ops-table';
  table.innerHTML = `<thead><tr>
    <th>Endpoint</th><th class="ops-num">Requests</th>
    <th class="ops-num">Avg (ms)</th><th class="ops-num">p95 (ms)</th>
    <th class="ops-num">p99 (ms)</th><th class="ops-num">Errors</th>
  </tr></thead>`;
  const tbody = document.createElement('tbody');
  for (const op of operations) {
    const tr = document.createElement('tr');
    const errCls = op.errorCount > 0 ? ' ops-error-cell' : '';
    tr.innerHTML = `
      <td class="ops-endpoint">${escapeHtml(op.operation)}</td>
      <td class="ops-num">${op.count}</td>
      <td class="ops-num">${op.avgDurationMs.toFixed(1)}</td>
      <td class="ops-num">${op.p95DurationMs.toFixed(1)}</td>
      <td class="ops-num ${latencyClass(op.p99DurationMs)}">${op.p99DurationMs.toFixed(1)}</td>
      <td class="ops-num${errCls}">${op.errorCount}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}
