/** Contract: contracts/observability/rules.md */
/* Main entry point for the admin observability dashboard */

const BASE = '/api/observability';
let currentForensicsEvents = [];
const { renderChart } = window.__obsChart;

// --- Tab navigation ---
document.querySelectorAll('.obs-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.obs-tab').forEach((t) => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    document.querySelectorAll('.obs-panel').forEach((p) => {
      p.classList.remove('active');
      p.hidden = true;
    });
    const panel = document.getElementById('panel-' + tab.dataset.tab);
    if (panel) { panel.classList.add('active'); panel.hidden = false; }
  });
});

// --- Helpers ---
function setDate(id, d) { const el = document.getElementById(id); if (el) el.value = d.toISOString().slice(0, 16); }
function getDate(id) { const el = document.getElementById(id); return el?.value ? new Date(el.value).toISOString() : ''; }
function fmtTime(iso) { return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }

// --- Telemetry init ---
const now = new Date();
setDate('ts-from', new Date(now.getTime() - 86400000));
setDate('ts-to', now);

function renderBreakdown(buckets) {
  const el = document.getElementById('ts-breakdown');
  if (!el) return;
  el.innerHTML = '';
  const byType = {};
  buckets.forEach(b => { const e = byType[b.contentType] ??= { sum: 0, count: 0 }; e.sum += b.avg; e.count += b.count; });
  for (const [ct, d] of Object.entries(byType)) {
    const card = document.createElement('div');
    card.className = 'obs-breakdown-card';
    card.innerHTML = `<h4>${ct}</h4><div class="obs-stat">${d.count}</div>
      <div style="font-size:0.75rem;color:var(--text-secondary)">samples - avg ${(d.sum / (d.count || 1)).toFixed(2)}</div>`;
    el.appendChild(card);
  }
}

document.getElementById('ts-query')?.addEventListener('click', async () => {
  const m = document.getElementById('ts-metric')?.value;
  const f = getDate('ts-from'), t = getDate('ts-to');
  if (!m || !f || !t) return;
  const r = await fetch(`${BASE}/metrics/timeseries?${new URLSearchParams({ metric: m, from: f, to: t })}`);
  const data = await r.json();
  renderChart(document.getElementById('ts-canvas'), data);
  renderBreakdown(data);
});

// --- Anomalies ---
function renderAlerts(container, alerts, onRefresh) {
  container.innerHTML = '';
  if (!alerts.length) { container.innerHTML = '<div class="obs-empty">No anomalies detected.</div>'; return; }
  alerts.forEach(a => {
    const card = document.createElement('div');
    card.className = 'obs-alert-card' + (a.acknowledgedAt ? ' acknowledged' : '');
    card.innerHTML = `
      <span class="obs-severity obs-severity--${a.severity}">${a.severity}</span>
      <div class="obs-alert-body">
        <div class="obs-alert-metric">${a.metric} (${a.contentType})</div>
        <div class="obs-alert-message">${a.message}</div>
      </div>
      <div class="obs-alert-time">${fmtTime(a.createdAt)}</div>
      <div class="obs-alert-actions"></div>`;
    if (!a.acknowledgedAt) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary'; btn.textContent = 'Acknowledge';
      btn.onclick = async (e) => { e.stopPropagation(); await fetch(`${BASE}/anomalies/${a.id}/acknowledge`, { method: 'POST' }); onRefresh(); };
      card.querySelector('.obs-alert-actions').appendChild(btn);
    }
    container.appendChild(card);
  });
}

document.getElementById('detect-anomalies')?.addEventListener('click', async () => {
  const r = await fetch(`${BASE}/anomalies/detect`, { method: 'POST' });
  renderAlerts(document.getElementById('alert-list'), await r.json(), () => document.getElementById('detect-anomalies').click());
});

// --- Forensics ---
function renderTimeline(container, events, onSelect) {
  container.innerHTML = '';
  if (!events.length) { container.innerHTML = '<div class="obs-empty">No events match the query.</div>'; return; }
  events.forEach(ev => {
    const row = document.createElement('div');
    row.className = 'obs-timeline-event';
    row.innerHTML = `
      <div class="obs-timeline-dot obs-timeline-dot--${ev.contentType}"></div>
      <div><strong>${ev.action}</strong> on <code>${ev.resourceId}</code><br>
        <small>${ev.actorId} (${ev.actorType}) - ${ev.eventType}</small></div>
      <div class="obs-alert-time">${fmtTime(ev.occurredAt)}</div>`;
    row.addEventListener('click', () => onSelect(ev));
    container.appendChild(row);
  });
}

document.getElementById('fr-query')?.addEventListener('click', async () => {
  const q = {};
  const type = document.getElementById('fr-type')?.value;
  const actor = document.getElementById('fr-actor')?.value;
  const action = document.getElementById('fr-action')?.value;
  const from = getDate('fr-from'), to = getDate('fr-to');
  if (type) q.contentType = type; if (actor) q.actorId = actor;
  if (action) q.action = action; if (from) q.from = from; if (to) q.to = to;
  const r = await fetch(`${BASE}/forensics?${new URLSearchParams(q)}`);
  currentForensicsEvents = await r.json();
  const panel = document.getElementById('forensics-detail');
  const pre = document.getElementById('fr-detail-content');
  renderTimeline(document.getElementById('forensics-timeline'), currentForensicsEvents,
    (ev) => { pre.textContent = JSON.stringify(ev, null, 2); panel.hidden = false; });
});

document.getElementById('fr-close-detail')?.addEventListener('click', () => { document.getElementById('forensics-detail').hidden = true; });
document.getElementById('fr-export-json')?.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(currentForensicsEvents, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'forensics.json'; a.click();
});

// --- SIEM ---
function renderConfigs(container, configs, onRefresh) {
  container.innerHTML = '';
  if (!configs.length) { container.innerHTML = '<div class="obs-empty">No SIEM integrations configured.</div>'; return; }
  configs.forEach(c => {
    const card = document.createElement('div');
    card.className = 'obs-config-card';
    card.innerHTML = `<div><div class="obs-config-name">${c.name}</div>
      <div class="obs-config-meta">${c.format.toUpperCase()} / ${c.mode}${c.endpoint ? ' -> ' + c.endpoint.slice(0, 30) : ''}</div></div>
      <div style="display:flex;align-items:center;gap:0.5rem">
        <span class="obs-config-status obs-config-status--${c.enabled ? 'enabled' : 'disabled'}"></span></div>`;
    const del = document.createElement('button');
    del.className = 'btn btn-secondary'; del.textContent = 'Remove'; del.style.fontSize = '0.6875rem';
    del.onclick = async () => { if (!confirm('Remove "' + c.name + '"?')) return; await fetch(`${BASE}/siem/configs/${c.id}`, { method: 'DELETE' }); onRefresh(); };
    card.querySelector('div:last-child').appendChild(del);
    container.appendChild(card);
  });
}

document.getElementById('siem-download')?.addEventListener('click', async () => {
  const fmt = document.getElementById('siem-format')?.value;
  const f = getDate('siem-from'), t = getDate('siem-to');
  if (!fmt || !f || !t) return;
  const r = await fetch(`${BASE}/siem/export?${new URLSearchParams({ format: fmt, from: f, to: t })}`);
  const blob = await r.blob(); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'siem-export.' + (fmt === 'jsonlines' ? 'ndjson' : 'txt'); a.click();
});

(async () => {
  const load = async () => { const r = await fetch(`${BASE}/siem/configs`); renderConfigs(document.getElementById('siem-config-list'), await r.json(), load); };
  try { await load(); } catch { /* not available yet */ }
})();

// --- Theme toggle ---
const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) {
  const upd = () => { themeBtn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? 'Light' : 'Dark'; };
  upd();
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next); localStorage.setItem('opendesk-theme', next); upd();
  });
}
