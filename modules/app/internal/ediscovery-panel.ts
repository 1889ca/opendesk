/** Contract: contracts/ediscovery/rules.md */
import { apiFetch } from './shared/api-client.ts';

type ExportType = 'sar' | 'foia';
type ExportFormat = 'json' | 'csv' | 'pdf';

/** Build the eDiscovery admin panel element. */
export function buildEDiscoveryPanel(): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'ediscovery-panel';

  panel.innerHTML = `
    <h2 class="ediscovery-title">eDiscovery Export</h2>
    <div class="ediscovery-tabs">
      <button class="ediscovery-tab ediscovery-tab--active" data-tab="sar">Subject Access Request</button>
      <button class="ediscovery-tab" data-tab="foia">Document History (FOIA)</button>
    </div>
    <div class="ediscovery-form" id="ediscovery-sar-form">
      <label class="ediscovery-label">User ID
        <input type="text" class="ediscovery-input" id="sar-user-id" placeholder="user-id" />
      </label>
      <label class="ediscovery-label">Format
        <select class="ediscovery-select" id="sar-format">
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
          <option value="pdf">Text Report</option>
        </select>
      </label>
      <button class="ediscovery-btn" id="sar-export-btn">Export SAR</button>
    </div>
    <div class="ediscovery-form ediscovery-form--hidden" id="ediscovery-foia-form">
      <label class="ediscovery-label">Document ID
        <input type="text" class="ediscovery-input" id="foia-doc-id" placeholder="document-id" />
      </label>
      <label class="ediscovery-label">Start Date
        <input type="datetime-local" class="ediscovery-input" id="foia-start" />
      </label>
      <label class="ediscovery-label">End Date
        <input type="datetime-local" class="ediscovery-input" id="foia-end" />
      </label>
      <label class="ediscovery-label">Format
        <select class="ediscovery-select" id="foia-format">
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
          <option value="pdf">Text Report</option>
        </select>
      </label>
      <button class="ediscovery-btn" id="foia-export-btn">Export Document History</button>
    </div>
    <div class="ediscovery-status" id="ediscovery-status"></div>
  `;

  bindTabs(panel);
  bindSarExport(panel);
  bindFoiaExport(panel);

  return panel;
}

function bindTabs(panel: HTMLElement): void {
  const tabs = panel.querySelectorAll<HTMLButtonElement>('.ediscovery-tab');
  const sarForm = panel.querySelector('#ediscovery-sar-form') as HTMLElement;
  const foiaForm = panel.querySelector('#ediscovery-foia-form') as HTMLElement;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('ediscovery-tab--active'));
      tab.classList.add('ediscovery-tab--active');
      const which = tab.dataset.tab;
      sarForm.classList.toggle('ediscovery-form--hidden', which !== 'sar');
      foiaForm.classList.toggle('ediscovery-form--hidden', which !== 'foia');
    });
  });
}

function bindSarExport(panel: HTMLElement): void {
  const btn = panel.querySelector('#sar-export-btn') as HTMLButtonElement;
  btn.addEventListener('click', async () => {
    const userId = (panel.querySelector('#sar-user-id') as HTMLInputElement).value.trim();
    const format = (panel.querySelector('#sar-format') as HTMLSelectElement).value as ExportFormat;
    if (!userId) { showStatus(panel, 'User ID is required', true); return; }
    await runExport(panel, 'sar', { userId, format });
  });
}

function bindFoiaExport(panel: HTMLElement): void {
  const btn = panel.querySelector('#foia-export-btn') as HTMLButtonElement;
  btn.addEventListener('click', async () => {
    const documentId = (panel.querySelector('#foia-doc-id') as HTMLInputElement).value.trim();
    const format = (panel.querySelector('#foia-format') as HTMLSelectElement).value as ExportFormat;
    const startRaw = (panel.querySelector('#foia-start') as HTMLInputElement).value;
    const endRaw = (panel.querySelector('#foia-end') as HTMLInputElement).value;
    if (!documentId) { showStatus(panel, 'Document ID is required', true); return; }

    const body: Record<string, string> = { documentId, format };
    if (startRaw) body.startDate = new Date(startRaw).toISOString();
    if (endRaw) body.endDate = new Date(endRaw).toISOString();
    await runExport(panel, 'foia', body);
  });
}

async function runExport(
  panel: HTMLElement,
  type: ExportType,
  body: Record<string, string>,
): Promise<void> {
  showStatus(panel, 'Exporting...', false);
  try {
    const res = await apiFetch(`/api/ediscovery/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      showStatus(panel, `Export failed: ${err.error || res.statusText}`, true);
      return;
    }

    const disposition = res.headers.get('Content-Disposition') || '';
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    const filename = filenameMatch?.[1] || `${type}-export.${body.format || 'json'}`;

    const blob = await res.blob();
    downloadBlob(blob, filename);
    showStatus(panel, `Export complete: ${filename}`, false);
  } catch (err) {
    showStatus(panel, `Export error: ${err}`, true);
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function showStatus(panel: HTMLElement, message: string, isError: boolean): void {
  const el = panel.querySelector('#ediscovery-status') as HTMLElement;
  el.textContent = message;
  el.classList.toggle('ediscovery-status--error', isError);
}
