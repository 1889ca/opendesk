/** Contract: contracts/app-kb/rules.md */

import { createSnapshotApi, fetchSnapshots, fetchSnapshotEntries, type KBSnapshotRecord, type SnapshotEntryRecord } from './kb-snapshot-api.ts';

/** Format a date string for display. */
function fmtDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

/** Count entries in a snapshot's entryVersions map. */
function entryCount(snap: KBSnapshotRecord): number {
  return Object.keys(snap.entryVersions).length;
}

/** Render the resolved entries for a snapshot into a container. */
function renderSnapshotEntries(container: HTMLElement, entries: SnapshotEntryRecord[]): void {
  container.innerHTML = '';
  if (entries.length === 0) {
    container.textContent = 'No entries in this snapshot.';
    return;
  }
  const table = document.createElement('table');
  table.className = 'kb-snapshot-entries-table';
  table.innerHTML = `<thead><tr>
    <th>Title</th><th>Version</th><th>Tags</th>
  </tr></thead>`;
  const tbody = document.createElement('tbody');
  for (const e of entries) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(e.title)}</td>
      <td>v${e.version}</td>
      <td>${e.tags.map(escapeHtml).join(', ')}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

/** Escape HTML to prevent XSS. */
function escapeHtml(str: string): string {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

/** Render a single snapshot row in the list. */
function renderSnapshotRow(
  snap: KBSnapshotRecord,
  onExpand: (snap: KBSnapshotRecord, detail: HTMLElement) => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'kb-snapshot-row';

  const header = document.createElement('button');
  header.className = 'kb-snapshot-row__header';
  header.innerHTML = `
    <span class="kb-snapshot-row__purpose">${escapeHtml(snap.purpose)}</span>
    <span class="kb-snapshot-row__meta">${entryCount(snap)} entries &middot; ${fmtDate(snap.capturedAt)}</span>`;

  const detail = document.createElement('div');
  detail.className = 'kb-snapshot-row__detail';
  detail.hidden = true;

  header.addEventListener('click', () => {
    detail.hidden = !detail.hidden;
    if (!detail.hidden) onExpand(snap, detail);
  });

  row.appendChild(header);
  row.appendChild(detail);
  return row;
}

/** Build the full snapshot panel with create form and list. */
export function buildSnapshotPanel(): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'kb-snapshot-panel';

  // --- Create form ---
  const form = document.createElement('form');
  form.className = 'kb-snapshot-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Snapshot purpose (e.g. Q4 regulatory filing)';
  input.className = 'kb-snapshot-form__input';
  input.required = true;
  input.maxLength = 500;

  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.className = 'btn btn-primary';
  btn.textContent = 'Create Snapshot';

  form.appendChild(input);
  form.appendChild(btn);

  // --- List container ---
  const listEl = document.createElement('div');
  listEl.className = 'kb-snapshot-list';

  // --- Status message ---
  const status = document.createElement('div');
  status.className = 'kb-snapshot-status';

  panel.appendChild(form);
  panel.appendChild(status);
  panel.appendChild(listEl);

  // --- Event handlers ---

  async function loadSnapshots(): Promise<void> {
    try {
      const snapshots = await fetchSnapshots();
      renderSnapshotList(listEl, snapshots);
    } catch (err) {
      listEl.textContent = `Failed to load snapshots: ${(err as Error).message}`;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const purpose = input.value.trim();
    if (!purpose) return;
    btn.disabled = true;
    status.textContent = 'Creating snapshot...';
    try {
      await createSnapshotApi(purpose);
      input.value = '';
      status.textContent = 'Snapshot created.';
      await loadSnapshots();
    } catch (err) {
      status.textContent = `Error: ${(err as Error).message}`;
    } finally {
      btn.disabled = false;
    }
  });

  // Initial load
  loadSnapshots();

  return panel;
}

/** Render the snapshot list into a container element. */
function renderSnapshotList(container: HTMLElement, snapshots: KBSnapshotRecord[]): void {
  container.innerHTML = '';
  if (snapshots.length === 0) {
    container.innerHTML = '<p class="kb-empty-state">No snapshots yet.</p>';
    return;
  }
  for (const snap of snapshots) {
    container.appendChild(
      renderSnapshotRow(snap, async (s, detail) => {
        detail.textContent = 'Loading entries...';
        try {
          const entries = await fetchSnapshotEntries(s.id);
          renderSnapshotEntries(detail, entries);
        } catch (err) {
          detail.textContent = `Error: ${(err as Error).message}`;
        }
      }),
    );
  }
}
