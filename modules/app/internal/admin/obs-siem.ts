/** Contract: contracts/observability/rules.md */

import type { SiemConfig } from './obs-api.ts';
import { deleteSiemConfig } from './obs-api.ts';

/** Render SIEM config list. */
export function renderSiemConfigs(
  container: HTMLElement,
  configs: SiemConfig[],
  onRefresh: () => void,
): void {
  container.innerHTML = '';

  if (configs.length === 0) {
    container.innerHTML = '<div class="obs-empty">No SIEM integrations configured.</div>';
    return;
  }

  for (const config of configs) {
    container.appendChild(createConfigCard(config, onRefresh));
  }
}

function createConfigCard(config: SiemConfig, onRefresh: () => void): HTMLElement {
  const card = document.createElement('div');
  card.className = 'obs-config-card';

  const left = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'obs-config-name';
  name.textContent = config.name;

  const meta = document.createElement('div');
  meta.className = 'obs-config-meta';
  meta.textContent = `${config.format.toUpperCase()} / ${config.mode}${config.endpoint ? ` -> ${truncateUrl(config.endpoint)}` : ''}`;

  left.appendChild(name);
  left.appendChild(meta);

  const right = document.createElement('div');
  right.style.display = 'flex';
  right.style.alignItems = 'center';
  right.style.gap = '0.5rem';

  const status = document.createElement('span');
  status.className = `obs-config-status obs-config-status--${config.enabled ? 'enabled' : 'disabled'}`;
  status.title = config.enabled ? 'Enabled' : 'Disabled';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-secondary';
  deleteBtn.textContent = 'Remove';
  deleteBtn.style.fontSize = '0.6875rem';
  deleteBtn.addEventListener('click', async () => {
    if (!confirm(`Remove integration "${config.name}"?`)) return;
    try {
      await deleteSiemConfig(config.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete config:', err);
    }
  });

  right.appendChild(status);
  right.appendChild(deleteBtn);
  card.appendChild(left);
  card.appendChild(right);

  return card;
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname.length > 1 ? u.pathname.slice(0, 20) + '...' : '');
  } catch {
    return url.slice(0, 30) + '...';
  }
}
