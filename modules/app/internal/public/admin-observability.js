/** Contract: contracts/observability/rules.md */
/* Entry point for the admin observability dashboard — plain JS for static serving */

const BASE = '/api/observability';
let currentForensicsEvents = [];

// --- Tab navigation ---

function setupTabs() {
  const tabs = document.querySelectorAll('.obs-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
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
      if (panel) {
        panel.classList.add('active');
        panel.hidden = false;
      }
    });
  });
}

// --- Time Series ---

const CT_COLORS = { document: '#3b82f6', sheet: '#10b981', slides: '#f59e0b', kb: '#8b5cf6' };

function renderChart(canvas, buckets) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const pad = { top: 20, right: 20, bottom: 40, left: 60 };
  const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;
  ctx.clearRect(0, 0, W, H);

  if (!buckets.length) {
    ctx.fillStyle = '#666'; ctx.font = '14px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('No data for selected range', W / 2, H / 2);
    return;
  }

  const maxVal = Math.max(...buckets.map(b => b.max), 1);
  const minT = new Date(buckets[0].bucket).getTime();
  const maxT = new Date(buckets[buckets.length - 1].bucket).getTime();
  const range = maxT - minT || 1;

  // Grid
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  ctx.strokeStyle = css('--border-color') || '#e0e0e0'; ctx.lineWidth = 0.5;
  ctx.font = '11px system-ui'; ctx.fillStyle = css('--text-secondary') || '#999'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + cH - (cH * i) / 4;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cW, y); ctx.stroke();
    ctx.fillText(((maxVal * i) / 4).toFixed(1), pad.left - 8, y + 4);
  }

  // Group by contentType and draw lines
  const grouped = {};
  buckets.forEach(b => (grouped[b.contentType] ??= []).push(b));

  for (const [ct, data] of Object.entries(grouped)) {
    ctx.strokeStyle = CT_COLORS[ct] || '#888'; ctx.lineWidth = 2; ctx.beginPath();
    data.forEach((d, i) => {
      const x = pad.left + ((new Date(d.bucket).getTime() - minT) / range) * cW;
      const y = pad.top + cH - (d.avg / maxVal) * cH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = CT_COLORS[ct] || '#888';
    data.forEach(d => {
      const x = pad.left + ((new Date(d.bucket).getTime() - minT) / range) * cW;
      const y = pad.top + cH - (d.avg / maxVal) * cH;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    });
  }

  // Time axis
  ctx.fillStyle = css('--text-secondary') || '#999'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(buckets.length / 6));
  for (let i = 0; i < buckets.length; i += step) {
    const x = pad.left + ((new Date(buckets[i].bucket).getTime() - minT) / range) * cW;
    ctx.fillText(new Date(buckets[i].bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), x, pad.top + cH + 20);
  }
}

function renderBreakdown(buckets) {
  const el = document.getElementById('ts-breakdown');
  if (!el) return;
  el.innerHTML = '';
  const byType = {};
  buckets.forEach(b => {
    const e = byType[b.contentType] ??= { sum: 0, count: 0 };
    e.sum += b.avg; e.count += b.count;
  });
  for (const [ct, d] of Object.entries(byType)) {
    const card = document.createElement('div');
    card.className = 'obs-breakdown-card';
    card.innerHTML = `<h4>${ct}</h4><div class="obs-stat">${d.count}</div>
      <div style="font-size:0.75rem;color:var(--text-secondary)">samples — avg ${(d.sum / (d.count || 1)).toFixed(2)}</div>`;
    el.appendChild(card);
  }
}

// --- Alerts ---

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
      <div class="obs-alert-time">${new Date(a.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      <div class="obs-alert-actions"></div>`;
    const actions = card.querySelector('.obs-alert-actions');
    if (!a.acknowledgedAt) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary'; btn.textContent = 'Acknowledge';
      btn.onclick = async (e) => { e.stopPropagation(); await fetch(`${BASE}/anomalies/${a.id}/acknowledge`, { method: 'POST' }); onRefresh(); };
      actions.appendChild(btn);
    }
    container.appendChild(card);
  });
}

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
        <small>${ev.actorId} (${ev.actorType}) — ${ev.eventType}</small></div>
      <div class="obs-alert-time">${new Date(ev.occurredAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>`;
    row.addEventListener('click', () => onSelect(ev));
    container.appendChild(row);
  });
}

// --- SIEM Configs ---

function renderConfigs(container, configs, onRefresh) {
  container.innerHTML = '';
  if (!configs.length) { container.innerHTML = '<div class="obs-empty">No SIEM integrations configured.</div>'; return; }
  configs.forEach(c => {
    const card = document.createElement('div');
    card.className = 'obs-config-card';
    card.innerHTML = `
      <div><div class="obs-config-name">${c.name}</div>
        <div class="obs-config-meta">${c.format.toUpperCase()} / ${c.mode}${c.endpoint ? ' -> ' + c.endpoint.slice(0, 30) : ''}</div></div>
      <div style="display:flex;align-items:center;gap:0.5rem">
        <span class="obs-config-status obs-config-status--${c.enabled ? 'enabled' : 'disabled'}"></span></div>`;
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-secondary'; delBtn.textContent = 'Remove'; delBtn.style.fontSize = '0.6875rem';
    delBtn.onclick = async () => { if (!confirm('Remove "' + c.name + '"?')) return; await fetch(`${BASE}/siem/configs/${c.id}`, { method: 'DELETE' }); onRefresh(); };
    card.querySelector('div:last-child').appendChild(delBtn);
    container.appendChild(card);
  });
}

// --- Init ---

function setDate(id, d) { const el = document.getElementById(id); if (el) el.value = d.toISOString().slice(0, 16); }
function getDate(id) { const el = document.getElementById(id); return el?.value ? new Date(el.value).toISOString() : ''; }

const now = new Date();
setDate('ts-from', new Date(now.getTime() - 86400000));
setDate('ts-to', now);

setupTabs();

document.getElementById('ts-query')?.addEventListener('click', async () => {
  const m = document.getElementById('ts-metric')?.value;
  const f = getDate('ts-from'), t = getDate('ts-to');
  if (!m || !f || !t) return;
  const r = await fetch(`${BASE}/metrics/timeseries?${new URLSearchParams({ metric: m, from: f, to: t })}`);
  const data = await r.json();
  renderChart(document.getElementById('ts-canvas'), data);
  renderBreakdown(data);
});

document.getElementById('detect-anomalies')?.addEventListener('click', async () => {
  const r = await fetch(`${BASE}/anomalies/detect`, { method: 'POST' });
  const alerts = await r.json();
  renderAlerts(document.getElementById('alert-list'), alerts, () => document.getElementById('detect-anomalies').click());
});

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
  renderTimeline(document.getElementById('forensics-timeline'), currentForensicsEvents, (ev) => { pre.textContent = JSON.stringify(ev, null, 2); panel.hidden = false; });
});

document.getElementById('fr-close-detail')?.addEventListener('click', () => { document.getElementById('forensics-detail').hidden = true; });
document.getElementById('fr-export-json')?.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(currentForensicsEvents, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'forensics.json'; a.click();
});

document.getElementById('siem-download')?.addEventListener('click', async () => {
  const fmt = document.getElementById('siem-format')?.value;
  const f = getDate('siem-from'), t = getDate('siem-to');
  if (!fmt || !f || !t) return;
  const r = await fetch(`${BASE}/siem/export?${new URLSearchParams({ format: fmt, from: f, to: t })}`);
  const blob = await r.blob(); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'siem-export.' + (fmt === 'jsonlines' ? 'ndjson' : 'txt'); a.click();
});

(async () => {
  const loadConfigs = async () => {
    const r = await fetch(`${BASE}/siem/configs`); const configs = await r.json();
    renderConfigs(document.getElementById('siem-config-list'), configs, loadConfigs);
  };
  try { await loadConfigs(); } catch { /* configs not available yet */ }
})();

// Theme toggle
const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) {
  const update = () => { themeBtn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? 'Light' : 'Dark'; };
  update();
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next); localStorage.setItem('opendesk-theme', next); update();
  });
}
