/** Contract: contracts/app/observability-dashboard.md */
import { apiFetch } from '../shared/api-client.ts';
import type { MetricsSummary } from '../admin-helpers.ts';
import { renderHealthPanel, renderOperationsTable } from './health-panel.ts';
import { renderVolumeChart, renderLatencyChart, type TimeSeriesPoint } from './metrics-charts.ts';
import { initCorrelationSearch } from './correlation-search.ts';
import { renderComplianceControls } from './compliance-export.ts';

interface DashboardState {
  rangeMinutes: number;
  refreshIntervalMs: number;
  filter: { operation?: string; statusCode?: string; actorType?: string };
  timer: ReturnType<typeof setInterval> | null;
}

const state: DashboardState = {
  rangeMinutes: 60,
  refreshIntervalMs: 30_000,
  filter: {},
  timer: null,
};

/** Build the observability dashboard section HTML. */
export function buildObservabilitySection(): string {
  return `
    <section id="obs-dashboard" class="admin-panel obs-panel-full">
      <div class="obs-header">
        <h2 class="admin-panel-title">Observability</h2>
        <div class="obs-controls">
          <select id="obs-range" class="obs-select">
            <option value="60">Last 1h</option>
            <option value="360">Last 6h</option>
            <option value="1440">Last 24h</option>
          </select>
          <select id="obs-refresh" class="obs-select">
            <option value="30000">30s refresh</option>
            <option value="15000">15s refresh</option>
            <option value="60000">60s refresh</option>
            <option value="0">Manual</option>
          </select>
          <button id="obs-refresh-btn" class="btn btn-secondary">Refresh</button>
        </div>
      </div>

      <div class="obs-filters">
        <input id="obs-filter-endpoint" class="obs-input" placeholder="Filter endpoint..." />
        <input id="obs-filter-status" class="obs-input obs-input-sm" placeholder="Status code" type="number" />
        <select id="obs-filter-actor" class="obs-select">
          <option value="">All actors</option>
          <option value="human">Human</option>
          <option value="agent">Agent</option>
          <option value="system">System</option>
        </select>
        <button id="obs-filter-apply" class="btn btn-secondary">Apply</button>
      </div>

      <div id="obs-health" class="health-grid"></div>

      <div class="obs-charts">
        <div class="obs-chart-box">
          <h3 class="obs-chart-title">Request Volume
            <span class="obs-legend"><span class="obs-dot obs-dot-blue"></span>Requests
            <span class="obs-dot obs-dot-red"></span>Errors</span></h3>
          <canvas id="obs-volume-chart"></canvas>
        </div>
        <div class="obs-chart-box">
          <h3 class="obs-chart-title">Latency
            <span class="obs-legend"><span class="obs-dot obs-dot-green"></span>p50
            <span class="obs-dot obs-dot-amber"></span>p95
            <span class="obs-dot obs-dot-red"></span>p99</span></h3>
          <canvas id="obs-latency-chart"></canvas>
        </div>
      </div>

      <div id="obs-operations"></div>

      <div class="obs-bottom-row">
        <div class="obs-corr-search">
          <h3 class="obs-section-title">Correlation ID Search</h3>
          <div id="obs-correlation"></div>
        </div>
        <div class="obs-compliance">
          <h3 class="obs-section-title">Compliance Evidence</h3>
          <div id="obs-compliance-controls" class="obs-export-btns"></div>
        </div>
      </div>
    </section>
  `;
}

/** Initialize the observability dashboard after DOM is ready. */
export function initObservabilityDashboard(): void {
  bindControls();
  initCorrelationSearch(document.getElementById('obs-correlation')!);
  loadDashboardData();
  startAutoRefresh();
}

/** Destroy the auto-refresh timer. */
export function destroyObservabilityDashboard(): void {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

function bindControls(): void {
  const rangeEl = document.getElementById('obs-range') as HTMLSelectElement;
  const refreshEl = document.getElementById('obs-refresh') as HTMLSelectElement;
  const refreshBtn = document.getElementById('obs-refresh-btn')!;
  const filterBtn = document.getElementById('obs-filter-apply')!;

  rangeEl.addEventListener('change', () => {
    state.rangeMinutes = Number(rangeEl.value);
    loadDashboardData();
  });

  refreshEl.addEventListener('change', () => {
    state.refreshIntervalMs = Number(refreshEl.value);
    startAutoRefresh();
  });

  refreshBtn.addEventListener('click', loadDashboardData);
  filterBtn.addEventListener('click', applyFilters);
}

function applyFilters(): void {
  const endpointEl = document.getElementById('obs-filter-endpoint') as HTMLInputElement;
  const statusEl = document.getElementById('obs-filter-status') as HTMLInputElement;
  const actorEl = document.getElementById('obs-filter-actor') as HTMLSelectElement;

  state.filter = {
    operation: endpointEl.value.trim() || undefined,
    statusCode: statusEl.value.trim() || undefined,
    actorType: actorEl.value || undefined,
  };
  loadDashboardData();
}

function startAutoRefresh(): void {
  if (state.timer) clearInterval(state.timer);
  if (state.refreshIntervalMs > 0) {
    state.timer = setInterval(loadDashboardData, state.refreshIntervalMs);
  }
}

async function loadDashboardData(): Promise<void> {
  const params = new URLSearchParams({ range: String(state.rangeMinutes) });
  if (state.filter.operation) params.set('operation', state.filter.operation);
  if (state.filter.statusCode) params.set('statusCode', state.filter.statusCode);
  if (state.filter.actorType) params.set('actorType', state.filter.actorType);

  try {
    const [metricsRes, tsRes] = await Promise.all([
      apiFetch('/api/admin/metrics'),
      apiFetch(`/api/admin/metrics/timeseries?${params}`),
    ]);

    if (!metricsRes.ok) throw new Error(`Metrics API ${metricsRes.status}`);
    if (!tsRes.ok) throw new Error(`Timeseries API ${tsRes.status}`);

    const summary: MetricsSummary = await metricsRes.json();
    const tsData: { points: TimeSeriesPoint[] } = await tsRes.json();

    renderHealthPanel(document.getElementById('obs-health')!, summary.health);
    renderOperationsTable(document.getElementById('obs-operations')!, summary.operations);
    renderVolumeChart(document.getElementById('obs-volume-chart') as HTMLCanvasElement, tsData.points);
    renderLatencyChart(document.getElementById('obs-latency-chart') as HTMLCanvasElement, tsData.points);
    renderComplianceControls(document.getElementById('obs-compliance-controls')!, summary);
  } catch (err) {
    console.error('Observability dashboard load failed', err);
  }
}

