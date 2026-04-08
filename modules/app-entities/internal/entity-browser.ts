/** Contract: contracts/app-entities/rules.md */
import { initTheme } from '@opendesk/app';
import { fetchEntities } from './entity-api.ts';
import { renderEntityList } from './entity-list-render.ts';
import { initEntityDialog, openCreateDialog } from './entity-dialog.ts';

let currentSubtype: string | undefined;
let currentQuery: string | undefined;

async function loadEntities(listEl: HTMLElement): Promise<void> {
  listEl.innerHTML = '<div class="entity-list-loading">Loading...</div>';
  try {
    const entities = await fetchEntities(currentSubtype, currentQuery);
    renderEntityList(listEl, entities, () => loadEntities(listEl));
  } catch (err) {
    console.error('Failed to load entities', err);
    listEl.innerHTML = '<div class="entity-list-empty"><p>Failed to load entities</p></div>';
  }
}

function initFilters(listEl: HTMLElement): void {
  const filters = document.getElementById('entity-filters');
  if (!filters) return;

  filters.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-subtype]') as HTMLElement | null;
    if (!btn) return;

    filters.querySelectorAll('.entity-filter').forEach((el) => {
      el.classList.remove('is-active');
    });
    btn.classList.add('is-active');

    currentSubtype = btn.dataset.subtype || undefined;
    loadEntities(listEl);
  });
}

function initSearch(listEl: HTMLElement): void {
  const input = document.getElementById('entity-search') as HTMLInputElement | null;
  if (!input) return;

  let timer: ReturnType<typeof setTimeout>;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      currentQuery = input.value.trim() || undefined;
      loadEntities(listEl);
    }, 250);
  });
}

function init(): void {
  initTheme();

  const listEl = document.getElementById('entity-list');
  if (!listEl) return;

  initEntityDialog(() => loadEntities(listEl));
  initFilters(listEl);
  initSearch(listEl);

  document.getElementById('new-entity-btn')?.addEventListener('click', () => {
    openCreateDialog();
  });

  loadEntities(listEl);
}

document.addEventListener('DOMContentLoaded', init);
