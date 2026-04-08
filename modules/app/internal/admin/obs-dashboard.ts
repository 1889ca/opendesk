/** Contract: contracts/observability/rules.md */

import {
  fetchTimeSeries,
  runDetection,
  fetchForensics,
  downloadSiemExport,
  fetchSiemConfigs,
} from './obs-api.ts';
import { renderTimeSeriesChart } from './obs-chart.ts';
import { renderAlertList } from './obs-alerts.ts';
import {
  renderForensicsTimeline,
  showEventDetail,
  buildForensicsQuery,
  exportForensicsJson,
} from './obs-forensics.ts';
import { renderSiemConfigs } from './obs-siem.ts';
import type { ForensicsEvent } from './obs-api.ts';

let currentForensicsEvents: ForensicsEvent[] = [];

/** Initialize the observability dashboard. */
export function initDashboard(): void {
  setupTabs();
  setupTelemetry();
  setupAnomalies();
  setupForensics();
  setupSiem();
  setupThemeToggle();
}

function setupTabs(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>('.obs-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      document.querySelectorAll<HTMLElement>('.obs-panel').forEach((p) => {
        p.classList.remove('active');
        p.hidden = true;
      });

      const panel = document.getElementById(`panel-${tab.dataset.tab}`);
      if (panel) {
        panel.classList.add('active');
        panel.hidden = false;
      }
    });
  });
}

function setupTelemetry(): void {
  // Set default date range to last 24 hours
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  setDateInput('ts-from', yesterday);
  setDateInput('ts-to', now);

  document.getElementById('ts-query')?.addEventListener('click', async () => {
    const metric = (document.getElementById('ts-metric') as HTMLSelectElement)?.value;
    const from = getDateInput('ts-from');
    const to = getDateInput('ts-to');
    if (!metric || !from || !to) return;

    try {
      const buckets = await fetchTimeSeries(metric, from, to);
      const canvas = document.getElementById('ts-canvas') as HTMLCanvasElement;
      if (canvas) renderTimeSeriesChart(canvas, buckets);
      renderBreakdown(buckets);
    } catch (err) {
      console.error('Failed to fetch time series:', err);
    }
  });
}

function setupAnomalies(): void {
  document.getElementById('detect-anomalies')?.addEventListener('click', async () => {
    try {
      const alerts = await runDetection();
      const container = document.getElementById('alert-list');
      if (container) renderAlertList(container, alerts, () => setupAnomalies());
    } catch (err) {
      console.error('Failed to run detection:', err);
    }
  });
}

function setupForensics(): void {
  const timeline = document.getElementById('forensics-timeline');
  const detailPanel = document.getElementById('forensics-detail') as HTMLElement;
  const detailContent = document.getElementById('fr-detail-content') as HTMLPreElement;

  document.getElementById('fr-query')?.addEventListener('click', async () => {
    const query = buildForensicsQuery();
    try {
      currentForensicsEvents = await fetchForensics(query);
      if (timeline) {
        renderForensicsTimeline(timeline, currentForensicsEvents, (event) => {
          showEventDetail(detailPanel, detailContent, event);
        });
      }
    } catch (err) {
      console.error('Failed to query forensics:', err);
    }
  });

  document.getElementById('fr-close-detail')?.addEventListener('click', () => {
    detailPanel.hidden = true;
  });

  document.getElementById('fr-export-json')?.addEventListener('click', () => {
    exportForensicsJson(currentForensicsEvents);
  });
}

function setupSiem(): void {
  const configList = document.getElementById('siem-config-list');

  const loadConfigs = async () => {
    try {
      const configs = await fetchSiemConfigs();
      if (configList) renderSiemConfigs(configList, configs, loadConfigs);
    } catch (err) {
      console.error('Failed to load SIEM configs:', err);
    }
  };

  loadConfigs();

  document.getElementById('siem-download')?.addEventListener('click', async () => {
    const format = (document.getElementById('siem-format') as HTMLSelectElement)?.value;
    const from = getDateInput('siem-from');
    const to = getDateInput('siem-to');
    if (!format || !from || !to) return;

    try {
      await downloadSiemExport(format, from, to);
    } catch (err) {
      console.error('Failed to download SIEM export:', err);
    }
  });
}

function setupThemeToggle(): void {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const update = () => {
    const theme = document.documentElement.getAttribute('data-theme');
    btn.textContent = theme === 'dark' ? 'Light' : 'Dark';
  };
  update();
  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('opendesk-theme', next);
    update();
  });
}

function renderBreakdown(buckets: { contentType: string; avg: number; count: number }[]): void {
  const container = document.getElementById('ts-breakdown');
  if (!container) return;
  container.innerHTML = '';

  const byType: Record<string, { sum: number; count: number }> = {};
  for (const b of buckets) {
    const entry = byType[b.contentType] ??= { sum: 0, count: 0 };
    entry.sum += b.avg;
    entry.count += b.count;
  }

  for (const [ct, data] of Object.entries(byType)) {
    const card = document.createElement('div');
    card.className = 'obs-breakdown-card';
    card.innerHTML = `
      <h4>${ct}</h4>
      <div class="obs-stat">${data.count}</div>
      <div style="font-size: 0.75rem; color: var(--text-secondary)">
        samples &mdash; avg ${(data.sum / (data.count || 1)).toFixed(2)}
      </div>
    `;
    container.appendChild(card);
  }
}

function setDateInput(id: string, date: Date): void {
  const el = document.getElementById(id) as HTMLInputElement;
  if (el) el.value = date.toISOString().slice(0, 16);
}

function getDateInput(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement;
  return el?.value ? new Date(el.value).toISOString() : '';
}
