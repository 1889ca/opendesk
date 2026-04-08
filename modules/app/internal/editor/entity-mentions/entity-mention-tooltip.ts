/** Contract: contracts/app/rules.md */
import { apiFetch } from '../../shared/api-client.ts';
import { getSubtypeConfig } from './types.ts';

let activeTooltip: HTMLElement | null = null;

/** Remove any active entity tooltip. */
export function closeEntityTooltip(): void {
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
}

/** Show a tooltip with entity details when clicking an entity mention. */
export async function showEntityTooltip(
  entityId: string,
  anchor: HTMLElement,
): Promise<void> {
  closeEntityTooltip();

  const res = await apiFetch(`/api/kb/entities/${encodeURIComponent(entityId)}`);
  if (!res.ok) return;
  const entity = await res.json();

  const tooltip = document.createElement('div');
  tooltip.className = 'entity-tooltip';
  tooltip.setAttribute('role', 'tooltip');

  const config = getSubtypeConfig(entity.subtype);

  const header = document.createElement('div');
  header.className = 'entity-tooltip__header';

  const badge = document.createElement('span');
  badge.className = 'entity-tooltip__badge';
  badge.style.backgroundColor = config.color;
  badge.textContent = config.icon;

  const name = document.createElement('span');
  name.className = 'entity-tooltip__name';
  name.textContent = entity.name;

  const subtypeEl = document.createElement('span');
  subtypeEl.className = 'entity-tooltip__subtype';
  subtypeEl.textContent = config.label;

  header.appendChild(badge);
  header.appendChild(name);
  header.appendChild(subtypeEl);
  tooltip.appendChild(header);

  const details = buildContentDetails(entity.subtype, entity.content);
  if (details) tooltip.appendChild(details);

  positionTooltip(tooltip, anchor);
  document.body.appendChild(tooltip);
  activeTooltip = tooltip;

  const onClickOutside = (e: MouseEvent) => {
    if (!tooltip.contains(e.target as Node)) {
      closeEntityTooltip();
      document.removeEventListener('click', onClickOutside);
    }
  };
  setTimeout(() => document.addEventListener('click', onClickOutside), 0);
}

function buildContentDetails(
  subtype: string,
  content: Record<string, unknown>,
): HTMLElement | null {
  const fields = getDisplayFields(subtype, content);
  if (fields.length === 0) return null;

  const dl = document.createElement('dl');
  dl.className = 'entity-tooltip__details';

  for (const [label, value] of fields) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = String(value);
    dl.appendChild(dt);
    dl.appendChild(dd);
  }
  return dl;
}

function getDisplayFields(
  subtype: string,
  content: Record<string, unknown>,
): [string, unknown][] {
  const fields: [string, unknown][] = [];

  switch (subtype) {
    case 'person':
      if (content.role) fields.push(['Role', content.role]);
      if (content.email) fields.push(['Email', content.email]);
      if (content.bio) fields.push(['Bio', content.bio]);
      break;
    case 'organization':
      if (content.orgType) fields.push(['Type', content.orgType]);
      if (content.website) fields.push(['Website', content.website]);
      if (content.description) fields.push(['About', content.description]);
      break;
    case 'project':
      if (content.status) fields.push(['Status', content.status]);
      if (content.description) fields.push(['About', content.description]);
      break;
    case 'term':
      if (content.definition) fields.push(['Definition', content.definition]);
      if (content.domain) fields.push(['Domain', content.domain]);
      break;
  }
  return fields;
}

function positionTooltip(tooltip: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  tooltip.style.position = 'fixed';
  tooltip.style.top = `${rect.bottom + 6}px`;
  tooltip.style.left = `${Math.max(8, rect.left)}px`;

  requestAnimationFrame(() => {
    const tooltipRect = tooltip.getBoundingClientRect();
    if (tooltipRect.right > window.innerWidth - 8) {
      tooltip.style.left = `${window.innerWidth - tooltipRect.width - 8}px`;
    }
    if (tooltipRect.bottom > window.innerHeight - 8) {
      tooltip.style.top = `${rect.top - tooltipRect.height - 6}px`;
    }
  });
}

/**
 * Initialize click handlers on entity mention nodes in the editor.
 * Call once after the editor mounts.
 */
export function initEntityMentionClicks(editorElement: HTMLElement): void {
  editorElement.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const mention = target.closest('[data-type="entity-mention"]');
    if (!mention) return;

    const entityId = (mention as HTMLElement).dataset.entityId;
    if (!entityId) return;

    showEntityTooltip(entityId, mention as HTMLElement);
  });
}
