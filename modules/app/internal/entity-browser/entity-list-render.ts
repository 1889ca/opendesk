/** Contract: contracts/app/rules.md */
import type { EntityRecord } from './entity-api.ts';
import { deleteEntityApi, fetchEntity } from './entity-api.ts';
import { openEditDialog } from './entity-dialog.ts';

const SUBTYPE_LABELS: Record<string, string> = {
  person: 'Person',
  organization: 'Organization',
  project: 'Project',
  term: 'Term',
};

const SUBTYPE_COLORS: Record<string, string> = {
  person: '#2563eb',
  organization: '#7c3aed',
  project: '#059669',
  term: '#d97706',
};

/**
 * Render a list of entities into the container element.
 */
export function renderEntityList(
  container: HTMLElement,
  entities: EntityRecord[],
  onRefresh: () => void,
): void {
  container.innerHTML = '';

  if (entities.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'entity-list-empty';
    const p = document.createElement('p');
    p.textContent = 'No entities found';
    empty.appendChild(p);
    container.appendChild(empty);
    return;
  }

  for (const entity of entities) {
    container.appendChild(createEntityCard(entity, onRefresh));
  }
}

function createEntityCard(
  entity: EntityRecord,
  onRefresh: () => void,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'entity-card';

  const header = document.createElement('div');
  header.className = 'entity-card__header';

  const badge = document.createElement('span');
  badge.className = 'entity-card__badge';
  badge.style.backgroundColor = SUBTYPE_COLORS[entity.subtype] ?? '#6b7280';
  badge.textContent = (entity.subtype[0] ?? '?').toUpperCase();

  const name = document.createElement('span');
  name.className = 'entity-card__name';
  name.textContent = entity.name;

  const subtypeLabel = document.createElement('span');
  subtypeLabel.className = 'entity-card__subtype';
  subtypeLabel.textContent = SUBTYPE_LABELS[entity.subtype] ?? entity.subtype;

  header.appendChild(badge);
  header.appendChild(name);
  header.appendChild(subtypeLabel);

  const summary = buildSummary(entity);

  const actions = document.createElement('div');
  actions.className = 'entity-card__actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-secondary btn-sm';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', async () => {
    const fresh = await fetchEntity(entity.id);
    openEditDialog(fresh);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-delete btn-sm';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => {
    if (!confirm(`Delete "${entity.name}"?`)) return;
    deleteEntityApi(entity.id).then(onRefresh).catch(console.error);
  });

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  card.appendChild(header);
  if (summary) card.appendChild(summary);
  card.appendChild(actions);
  return card;
}

function buildSummary(entity: EntityRecord): HTMLElement | null {
  const c = entity.content;
  const parts: string[] = [];

  switch (entity.subtype) {
    case 'person':
      if (c.role) parts.push(String(c.role));
      if (c.email) parts.push(String(c.email));
      break;
    case 'organization':
      if (c.orgType) parts.push(String(c.orgType));
      if (c.website) parts.push(String(c.website));
      break;
    case 'project':
      if (c.status) parts.push(String(c.status));
      break;
    case 'term':
      if (c.definition) parts.push(String(c.definition).slice(0, 100));
      break;
  }

  if (parts.length === 0) return null;

  const el = document.createElement('div');
  el.className = 'entity-card__summary';
  el.textContent = parts.join(' \u00B7 ');
  return el;
}
