/** Contract: contracts/app/rules.md */

import { fetchGraphData } from './graph-data.ts';
import { renderGraph } from './graph-renderer.ts';

/**
 * Open a modal overlay showing a relationship graph centered on the given entry.
 */
export function openGraphPanel(entryId: string, onEntryClick: (id: string) => void): void {
  // Remove any existing graph panel
  document.querySelector('.kb-graph-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'kb-graph-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Relationship graph');

  const dialog = document.createElement('div');
  dialog.className = 'kb-graph-dialog';

  // Header with close button and depth selector
  const header = document.createElement('div');
  header.className = 'kb-graph-dialog__header';

  const title = document.createElement('h2');
  title.className = 'kb-graph-dialog__title';
  title.textContent = 'Relationship Graph';

  const controls = document.createElement('div');
  controls.className = 'kb-graph-dialog__controls';

  const depthLabel = document.createElement('label');
  depthLabel.className = 'kb-graph-dialog__depth-label';
  depthLabel.textContent = 'Depth: ';

  const depthSelect = document.createElement('select');
  depthSelect.className = 'kb-graph-dialog__depth-select';
  for (const d of [1, 2, 3]) {
    const opt = document.createElement('option');
    opt.value = String(d);
    opt.textContent = String(d);
    depthSelect.appendChild(opt);
  }
  depthLabel.appendChild(depthSelect);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'kb-graph-dialog__close';
  closeBtn.textContent = '\u00D7';
  closeBtn.setAttribute('aria-label', 'Close graph panel');
  closeBtn.addEventListener('click', () => overlay.remove());

  controls.appendChild(depthLabel);
  controls.appendChild(closeBtn);
  header.appendChild(title);
  header.appendChild(controls);

  // Graph container
  const graphContainer = document.createElement('div');
  graphContainer.className = 'kb-graph-dialog__body';

  dialog.appendChild(header);
  dialog.appendChild(graphContainer);
  overlay.appendChild(dialog);

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Close on Escape
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);

  // Load and render
  let currentDepth = 1;
  loadGraph(entryId, currentDepth, graphContainer, onEntryClick, overlay);

  depthSelect.addEventListener('change', () => {
    currentDepth = Number(depthSelect.value);
    loadGraph(entryId, currentDepth, graphContainer, onEntryClick, overlay);
  });
}

async function loadGraph(
  entryId: string,
  depth: number,
  container: HTMLElement,
  onEntryClick: (id: string) => void,
  overlay: HTMLElement,
): Promise<void> {
  container.innerHTML = '<p class="kb-graph-loading">Loading graph\u2026</p>';
  try {
    const data = await fetchGraphData(entryId, depth);
    renderGraph(container, data, entryId, (id) => {
      overlay.remove();
      onEntryClick(id);
    });
  } catch {
    container.innerHTML = '<p class="kb-graph-error">Failed to load graph data.</p>';
  }
}

/** Create a "View Graph" button that opens the graph panel for the given entry. */
export function createGraphButton(
  entryId: string,
  onEntryClick: (id: string) => void,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'btn btn-secondary btn-sm kb-graph-btn';
  btn.textContent = 'View Graph';
  btn.setAttribute('aria-label', 'View relationship graph');
  btn.addEventListener('click', () => openGraphPanel(entryId, onEntryClick));
  return btn;
}
