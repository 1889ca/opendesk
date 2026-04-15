/** Contract: contracts/app-kb/rules.md */

import { fetchKBSettings, updateKBSettings, type KBSettings } from './kb-api.ts';
import { showToast } from '../../app/internal/shared/toast.ts';

let settingsPanel: HTMLElement | null = null;
let currentSettings: KBSettings | null = null;

/** Copy text to clipboard and show a toast. */
async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Public link copied to clipboard', 'success');
  } catch {
    showToast('Failed to copy link', 'error');
  }
}

/** Render the public URL section inside the settings panel. */
function renderPublicUrlSection(container: HTMLElement, settings: KBSettings): void {
  const existing = container.querySelector('.kb-public-url-section');
  if (existing) existing.remove();

  if (!settings.is_public || !settings.public_url) return;

  const section = document.createElement('div');
  section.className = 'kb-public-url-section';

  const label = document.createElement('p');
  label.className = 'kb-public-url-label';
  label.textContent = 'Public link:';

  const row = document.createElement('div');
  row.className = 'kb-public-url-row';

  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.className = 'kb-public-url-input';
  urlInput.value = settings.public_url;
  urlInput.readOnly = true;
  urlInput.setAttribute('aria-label', 'Public KB URL');

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn btn-secondary btn-sm';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', () => copyToClipboard(settings.public_url!));

  row.appendChild(urlInput);
  row.appendChild(copyBtn);
  section.appendChild(label);
  section.appendChild(row);
  container.appendChild(section);
}

/** Build the settings panel for KB public access. */
export function buildPublicSettingsPanel(onClose: () => void): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'kb-settings-overlay';
  overlay.hidden = true;

  const panel = document.createElement('div');
  panel.className = 'kb-settings-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Knowledge Base Settings');

  const header = document.createElement('div');
  header.className = 'kb-settings-panel__header';

  const title = document.createElement('h2');
  title.className = 'kb-settings-panel__title';
  title.textContent = 'KB Settings';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'kb-settings-panel__close';
  closeBtn.setAttribute('aria-label', 'Close settings');
  closeBtn.textContent = '\u00D7';
  closeBtn.addEventListener('click', () => {
    overlay.hidden = true;
    onClose();
  });

  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'kb-settings-panel__body';

  const toggleRow = document.createElement('div');
  toggleRow.className = 'kb-settings-toggle-row';

  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'kb-settings-toggle-label';
  toggleLabel.htmlFor = 'kb-public-toggle';
  toggleLabel.textContent = 'Make this Knowledge Base public (read-only for anyone with the link)';

  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.id = 'kb-public-toggle';
  toggle.className = 'kb-settings-toggle';

  toggle.addEventListener('change', async () => {
    toggle.disabled = true;
    try {
      const result = await updateKBSettings(toggle.checked);
      currentSettings = { is_public: result.is_public, public_url: result.public_url };
      renderPublicUrlSection(body, currentSettings);
      showToast(
        result.is_public ? 'Knowledge base is now public' : 'Knowledge base is now private',
        'success',
      );
    } catch (err) {
      toggle.checked = !toggle.checked;
      showToast(err instanceof Error ? err.message : 'Failed to update settings', 'error');
    } finally {
      toggle.disabled = false;
    }
  });

  toggleRow.appendChild(toggle);
  toggleRow.appendChild(toggleLabel);
  body.appendChild(toggleRow);

  // Load initial settings
  fetchKBSettings()
    .then((settings) => {
      currentSettings = settings;
      toggle.checked = settings.is_public;
      renderPublicUrlSection(body, settings);
    })
    .catch(() => {
      showToast('Failed to load KB settings', 'error');
    });

  panel.appendChild(header);
  panel.appendChild(body);
  overlay.appendChild(panel);

  settingsPanel = overlay;
  return overlay;
}

/** Open the settings panel overlay. */
export function openPublicSettings(): void {
  if (settingsPanel) settingsPanel.hidden = false;
}

/** Build a share button that copies the public link if the KB is public. */
export function buildShareButton(): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'btn btn-secondary';
  btn.textContent = 'Share';
  btn.setAttribute('aria-label', 'Copy public link or open share settings');

  btn.addEventListener('click', async () => {
    try {
      const settings = await fetchKBSettings();
      if (settings.is_public && settings.public_url) {
        await copyToClipboard(settings.public_url);
      } else {
        showToast('Enable public access in KB Settings to get a shareable link', 'info');
        openPublicSettings();
      }
    } catch {
      showToast('Failed to get share link', 'error');
    }
  });

  return btn;
}
