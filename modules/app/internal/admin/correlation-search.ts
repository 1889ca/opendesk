/** Contract: contracts/app/observability-dashboard.md */
import { apiFetch } from '../shared/api-client.ts';
import { escapeHtml } from '../admin-helpers.ts';

export interface MetricEntry {
  id: string;
  correlationId: string;
  service: string;
  operation: string;
  durationMs: number;
  statusCode?: number;
  actorId?: string;
  actorType?: string;
  tags: Record<string, unknown>;
  timestamp: string;
}

/** Create the correlation ID search UI and bind it to a container. */
export function initCorrelationSearch(container: HTMLElement): void {
  container.innerHTML = `
    <form class="corr-search-form" autocomplete="off">
      <input type="text" class="corr-search-input" placeholder="Enter correlation ID (UUIDv4)..."
             pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}" />
      <button type="submit" class="btn btn-secondary corr-search-btn">Search</button>
    </form>
    <div class="corr-search-results"></div>
  `;

  const form = container.querySelector('.corr-search-form') as HTMLFormElement;
  const input = container.querySelector('.corr-search-input') as HTMLInputElement;
  const results = container.querySelector('.corr-search-results') as HTMLElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const correlationId = input.value.trim();
    if (!correlationId) return;

    results.innerHTML = '<div class="admin-loading">Searching...</div>';

    try {
      const res = await apiFetch(`/api/admin/metrics/search?correlationId=${encodeURIComponent(correlationId)}`);
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const data: { entries: MetricEntry[] } = await res.json();
      renderSearchResults(results, data.entries, correlationId);
    } catch (err) {
      results.innerHTML = `<div class="admin-error">Search failed: ${escapeHtml(String(err))}</div>`;
    }
  });
}

/** Render correlation search results as a table. */
function renderSearchResults(container: HTMLElement, entries: MetricEntry[], correlationId: string): void {
  container.innerHTML = '';

  if (entries.length === 0) {
    container.innerHTML = `<div class="admin-empty">No metrics found for correlation ID ${escapeHtml(correlationId)}</div>`;
    return;
  }

  const header = document.createElement('div');
  header.className = 'corr-result-header';
  header.textContent = `${entries.length} metric(s) for ${correlationId}`;
  container.appendChild(header);

  const table = document.createElement('table');
  table.className = 'ops-table corr-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>
    <th>Timestamp</th>
    <th>Service</th>
    <th>Operation</th>
    <th class="ops-num">Status</th>
    <th class="ops-num">Duration (ms)</th>
    <th>Actor</th>
  </tr>`;

  const tbody = document.createElement('tbody');
  for (const entry of entries) {
    const tr = document.createElement('tr');
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const statusClass = (entry.statusCode ?? 0) >= 500 ? ' ops-error-cell' : '';
    tr.innerHTML = `
      <td>${escapeHtml(time)}</td>
      <td>${escapeHtml(entry.service)}</td>
      <td class="ops-endpoint">${escapeHtml(entry.operation)}</td>
      <td class="ops-num${statusClass}">${entry.statusCode ?? '-'}</td>
      <td class="ops-num">${entry.durationMs.toFixed(1)}</td>
      <td>${escapeHtml(entry.actorType ?? '-')}</td>
    `;
    tbody.appendChild(tr);
  }

  table.append(thead, tbody);
  container.appendChild(table);
}
