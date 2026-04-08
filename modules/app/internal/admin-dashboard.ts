/** Contract: contracts/app/rules.md */
import { apiFetch } from './shared/api-client.ts';
import { initTheme } from './shared/theme-toggle.ts';
import {
  formatIndicatorName, formatValue, formatUptime, latencyClass, escapeHtml,
  type HealthIndicator, type OperationSummary, type MetricsSummary, type AuditSummary,
} from './admin-helpers.ts';
import { buildObservabilitySection, initObservabilityDashboard } from './admin/observability-dashboard.ts';

// --- Rendering ---

const STATUS_COLORS: Record<string, string> = {
  ok: 'var(--connected, #22c55e)',
  warning: 'var(--accent, #f59e0b)',
  critical: 'var(--disconnected, #ef4444)',
};

function renderHealthIndicators(container: HTMLElement, indicators: HealthIndicator[]): void {
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
    value.textContent = ind.value === -1 ? 'UNAVAILABLE' : `${formatValue(ind.value)} ${ind.unit ?? ''}`.trim();

    const status = document.createElement('span');
    status.className = `health-status health-status-${ind.status}`;
    status.textContent = ind.status.toUpperCase();

    card.append(dot, label, value, status);
    container.appendChild(card);
  }
}

function renderOperations(container: HTMLElement, operations: OperationSummary[]): void {
  container.innerHTML = '';

  if (operations.length === 0) {
    container.innerHTML = '<div class="admin-empty">No request metrics yet.</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'ops-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>
    <th>Endpoint</th>
    <th class="ops-num">Requests</th>
    <th class="ops-num">Avg (ms)</th>
    <th class="ops-num">p95 (ms)</th>
    <th class="ops-num">p99 (ms)</th>
    <th class="ops-num">Errors</th>
  </tr>`;

  const tbody = document.createElement('tbody');
  for (const op of operations) {
    const tr = document.createElement('tr');
    const errorClass = op.errorCount > 0 ? ' ops-error-cell' : '';
    tr.innerHTML = `
      <td class="ops-endpoint">${escapeHtml(op.operation)}</td>
      <td class="ops-num">${op.count}</td>
      <td class="ops-num">${op.avgDurationMs.toFixed(1)}</td>
      <td class="ops-num">${op.p95DurationMs.toFixed(1)}</td>
      <td class="ops-num ${latencyClass(op.p99DurationMs)}">${op.p99DurationMs.toFixed(1)}</td>
      <td class="ops-num${errorClass}">${op.errorCount}</td>
    `;
    tbody.appendChild(tr);
  }

  table.append(thead, tbody);
  container.appendChild(table);
}

function renderInfoGrid(container: HTMLElement, items: Array<{ label: string; value: string }>): void {
  container.innerHTML = '';
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'sysinfo-row';
    const label = document.createElement('span');
    label.className = 'sysinfo-label';
    label.textContent = item.label;
    const value = document.createElement('span');
    value.className = 'sysinfo-value';
    value.textContent = item.value;
    row.append(label, value);
    container.appendChild(row);
  }
}

function renderSystemInfo(container: HTMLElement, summary: MetricsSummary): void {
  renderInfoGrid(container, [
    { label: 'Uptime', value: formatUptime(summary.uptime) },
    { label: 'Last Updated', value: new Date(summary.timestamp).toLocaleTimeString() },
    { label: 'Health Probes', value: String(summary.health.length) },
    { label: 'Tracked Endpoints', value: String(summary.operations.length) },
    { label: 'Total Requests', value: String(summary.operations.reduce((s, op) => s + op.count, 0)) },
    { label: 'Total Errors', value: String(summary.operations.reduce((s, op) => s + op.errorCount, 0)) },
  ]);
}

function renderAuditInfo(container: HTMLElement, audit: AuditSummary): void {
  renderInfoGrid(container, [
    { label: 'Total Entries', value: String(audit.totalEntries) },
    { label: 'Documents Tracked', value: String(audit.documentsTracked) },
    { label: 'Last Activity', value: audit.lastEntryAt ? new Date(audit.lastEntryAt).toLocaleString() : 'None' },
  ]);
}

// --- Data Loading ---

async function loadDashboard(): Promise<void> {
  const healthEl = document.getElementById('health-indicators')!;
  const opsEl = document.getElementById('operations-table')!;
  const sysEl = document.getElementById('system-info')!;
  const auditEl = document.getElementById('audit-info')!;

  try {
    const [metricsRes, auditRes] = await Promise.all([
      apiFetch('/api/admin/metrics'),
      apiFetch('/api/admin/metrics/audit'),
    ]);

    if (!metricsRes.ok) throw new Error(`Metrics API ${metricsRes.status}`);
    const summary: MetricsSummary = await metricsRes.json();

    renderHealthIndicators(healthEl, summary.health);
    renderOperations(opsEl, summary.operations);
    renderSystemInfo(sysEl, summary);

    if (auditRes.ok) {
      const audit: AuditSummary = await auditRes.json();
      renderAuditInfo(auditEl, audit);
    } else {
      auditEl.innerHTML = '<div class="admin-error">Failed to load audit data</div>';
    }
  } catch (err) {
    console.error('Failed to load metrics', err);
    healthEl.innerHTML = '<div class="admin-error">Failed to load health data</div>';
    opsEl.innerHTML = '<div class="admin-error">Failed to load metrics</div>';
    sysEl.innerHTML = '<div class="admin-error">Failed to load system info</div>';
    auditEl.innerHTML = '<div class="admin-error">Failed to load audit data</div>';
  }
}

// --- Init ---

function init(): void {
  initTheme();
  loadDashboard();

  // Auto-refresh every 30s
  setInterval(loadDashboard, 30_000);

  document.getElementById('refresh-btn')?.addEventListener('click', loadDashboard);

  // Inject observability dashboard section into the admin grid
  const adminGrid = document.querySelector('.admin-grid');
  if (adminGrid) {
    adminGrid.insertAdjacentHTML('beforeend', buildObservabilitySection());
    initObservabilityDashboard();
  }
}

document.addEventListener('DOMContentLoaded', init);
