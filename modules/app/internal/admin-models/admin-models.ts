/** Contract: contracts/app/rules.md */
import { fetchModels, addCustomModel, type ModelListItem, type ModelConfig } from './api.ts';
import { renderConfig, filterModels, renderCard } from './render.ts';
import { initTheme } from '../shared/theme-toggle.ts';

let allModels: ModelListItem[] = [];
let activeConfig: ModelConfig | null = null;

function getFilters() {
  return {
    capability: (document.getElementById('filter-capability') as HTMLSelectElement).value,
    tier: (document.getElementById('filter-tier') as HTMLSelectElement).value,
    usecase: (document.getElementById('filter-usecase') as HTMLSelectElement).value,
    status: (document.getElementById('filter-status') as HTMLSelectElement).value,
  };
}

function renderGrid(): void {
  const grid = document.getElementById('model-grid')!;
  grid.innerHTML = '';

  if (!activeConfig) {
    grid.innerHTML = '<div class="loading">Loading models...</div>';
    return;
  }

  const filtered = filterModels(allModels, getFilters());
  if (!filtered.length) {
    grid.innerHTML = '<div class="no-results">No models match the current filters.</div>';
    return;
  }

  for (const model of filtered) {
    grid.append(renderCard(model, activeConfig, loadAndRender));
  }
}

async function loadAndRender(): Promise<void> {
  try {
    const data = await fetchModels();
    allModels = data.models;
    activeConfig = data.config;
    renderConfig(activeConfig, allModels);
    renderGrid();
  } catch (err) {
    const grid = document.getElementById('model-grid')!;
    grid.innerHTML = `<div class="error-msg">Failed to load models. Is Ollama running?</div>`;
  }
}

function setupFilters(): void {
  for (const id of ['filter-capability', 'filter-tier', 'filter-usecase', 'filter-status']) {
    document.getElementById(id)?.addEventListener('change', renderGrid);
  }
}

function setupCustomDialog(): void {
  const dialog = document.getElementById('custom-model-dialog') as HTMLDialogElement;
  const form = document.getElementById('custom-model-form') as HTMLFormElement;
  const addBtn = document.getElementById('add-custom-btn')!;
  const cancelBtn = document.getElementById('cancel-custom')!;

  addBtn.addEventListener('click', () => dialog.showModal());
  cancelBtn.addEventListener('click', () => dialog.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = fd.get('name') as string;
    const ollamaTag = fd.get('ollamaTag') as string;
    const capability = fd.get('capability') as string;

    await addCustomModel(name, ollamaTag, capability);
    dialog.close();
    form.reset();
    await loadAndRender();
  });
}

// Boot
initTheme();
setupFilters();
setupCustomDialog();
loadAndRender();
