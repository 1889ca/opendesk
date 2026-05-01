/** Contract: contracts/app-admin/rules.md */
import { apiFetch } from '@opendesk/app';
import { escapeHtml } from './admin-helpers.ts';
import {
  type FederationPeerHealth,
  type PingResult,
  formatRelativeTime,
  connectionStatusLabel,
} from './federation-health-types.ts';

const POLL_INTERVAL_MS = 30_000;

let _container: HTMLElement | null = null;
let _timer: ReturnType<typeof setInterval> | null = null;

/** Build the federation health section HTML string (injected into admin-grid). */
export function buildFederationHealthSection(): string {
  return `
    <section id="fed-health" class="admin-panel fed-panel-full">
      <div class="fed-header">
        <h2 class="admin-panel-title">Federation Peer Health</h2>
        <button id="fed-refresh-btn" class="btn btn-secondary">Refresh</button>
      </div>
      <div id="fed-peer-list" class="fed-peer-list">
        <div class="admin-loading">Loading federation peers…</div>
      </div>
    </section>
  `;
}

/** Initialize auto-polling and wire up the refresh button. */
export function initFederationHealthPanel(): void {
  _container = document.getElementById('fed-peer-list');
  if (!_container) return;

  document.getElementById('fed-refresh-btn')?.addEventListener('click', loadAndRender);

  loadAndRender();
  _timer = setInterval(loadAndRender, POLL_INTERVAL_MS);
}

export function destroyFederationHealthPanel(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

async function loadAndRender(): Promise<void> {
  if (!_container) return;
  try {
    const res = await apiFetch('/api/federation/peers/health');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const entries: FederationPeerHealth[] = await res.json();
    renderPeerList(_container!, entries);
  } catch (err) {
    _container!.innerHTML = `<div class="admin-error">Failed to load federation health: ${escapeHtml(String(err))}</div>`;
  }
}

function renderPeerList(container: HTMLElement, entries: FederationPeerHealth[]): void {
  if (entries.length === 0) {
    container.innerHTML = '<div class="admin-empty">No federation peers registered.</div>';
    return;
  }

  container.innerHTML = '';
  for (const entry of entries) {
    container.appendChild(buildPeerCard(entry));
  }
}

function buildPeerCard(entry: FederationPeerHealth): HTMLElement {
  const card = document.createElement('div');
  card.className = `fed-peer-card fed-status-${entry.connectionStatus}`;
  card.dataset.peerId = entry.peer.id;

  const dot = document.createElement('span');
  dot.className = `fed-status-dot fed-dot-${entry.connectionStatus}`;
  dot.setAttribute('aria-label', connectionStatusLabel(entry.connectionStatus));

  const info = document.createElement('div');
  info.className = 'fed-peer-info';
  info.innerHTML = `
    <span class="fed-peer-name">${escapeHtml(entry.peer.name)}</span>
    <span class="fed-peer-url">${escapeHtml(entry.peer.endpointUrl)}</span>
  `;

  const meta = document.createElement('div');
  meta.className = 'fed-peer-meta';
  meta.innerHTML = `
    <span class="fed-meta-item" title="Last successful sync">
      Sync: <strong>${escapeHtml(formatRelativeTime(entry.lastSuccessfulSyncAt))}</strong>
    </span>
    <span class="fed-meta-item" title="Last contact">
      Seen: <strong>${escapeHtml(formatRelativeTime(entry.peer.lastSeenAt))}</strong>
    </span>
    <span class="fed-meta-item fed-meta-conflicts ${entry.conflictCount > 0 ? 'fed-meta-warn' : ''}" title="Document conflicts (all time)">
      Conflicts: <strong>${entry.conflictCount}</strong>
    </span>
    <span class="fed-meta-item fed-meta-fails ${entry.failedRequestCount > 0 ? 'fed-meta-warn' : ''}" title="Failed requests (last 24h)">
      Failures 24h: <strong>${entry.failedRequestCount}</strong>
    </span>
  `;

  const pingBtn = document.createElement('button');
  pingBtn.className = 'btn btn-secondary fed-ping-btn';
  pingBtn.textContent = 'Ping';
  pingBtn.addEventListener('click', () => handlePing(entry.peer.id, pingBtn, card));

  card.append(dot, info, meta, pingBtn);
  return card;
}

async function handlePing(peerId: string, btn: HTMLButtonElement, card: HTMLElement): Promise<void> {
  btn.disabled = true;
  btn.textContent = 'Pinging…';

  try {
    const res = await apiFetch(`/api/federation/peers/${encodeURIComponent(peerId)}/ping`, { method: 'POST' });
    const result: PingResult = await res.json();

    const resultEl = card.querySelector('.fed-ping-result') ?? document.createElement('span');
    resultEl.className = `fed-ping-result ${result.reachable ? 'fed-ping-ok' : 'fed-ping-fail'}`;
    resultEl.textContent = result.reachable
      ? `OK (${result.latencyMs}ms)`
      : `Unreachable: ${result.error ?? 'unknown'}`;

    if (!card.querySelector('.fed-ping-result')) card.appendChild(resultEl);

    if (result.reachable) loadAndRender();
  } catch (err) {
    btn.textContent = 'Ping failed';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ping';
  }
}
