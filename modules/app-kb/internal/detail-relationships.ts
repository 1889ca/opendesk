/** Contract: contracts/app-kb/rules.md */

import { fetchEntry, fetchRelationships, type KBRelationshipRecord } from './kb-api.ts';

const RELATION_LABELS: Record<string, string> = {
  cites: 'Cites',
  'authored-by': 'Authored By',
  'related-to': 'Related To',
  'derived-from': 'Derived From',
  supersedes: 'Supersedes',
};

/** Load and render relationships for an entry into the container. */
export async function loadRelationships(entryId: string, container: HTMLElement): Promise<void> {
  try {
    const rels = await fetchRelationships(entryId, 'both');
    renderRelationships(entryId, rels, container);
  } catch {
    container.innerHTML = '<h3>Related Entries</h3><p class="kb-detail__error">Failed to load relationships</p>';
  }
}

function renderRelationships(
  entryId: string,
  rels: KBRelationshipRecord[],
  container: HTMLElement,
): void {
  container.innerHTML = '<h3>Related Entries</h3>';

  if (rels.length === 0) {
    const p = document.createElement('p');
    p.className = 'kb-detail__no-rels';
    p.textContent = 'No related entries';
    container.appendChild(p);
    return;
  }

  // Group by relation type
  const grouped = new Map<string, KBRelationshipRecord[]>();
  for (const rel of rels) {
    const key = rel.relationType;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(rel);
  }

  for (const [type, group] of grouped) {
    const heading = document.createElement('h4');
    heading.className = 'kb-detail__rel-type';
    heading.textContent = RELATION_LABELS[type] ?? type;
    container.appendChild(heading);

    const list = document.createElement('ul');
    list.className = 'kb-detail__rel-list';

    for (const rel of group) {
      const li = document.createElement('li');
      const targetId = rel.sourceId === entryId ? rel.targetId : rel.sourceId;
      const direction = rel.sourceId === entryId ? '\u2192' : '\u2190';
      const dirSpan = document.createElement('span');
      dirSpan.className = 'kb-detail__rel-direction';
      dirSpan.textContent = direction;
      li.appendChild(dirSpan);
      li.appendChild(document.createTextNode(' '));

      const link = document.createElement('a');
      link.href = `/kb?detail=${targetId}`;
      link.className = 'kb-detail__rel-link';
      link.textContent = targetId.slice(0, 8) + '\u2026';
      // Resolve the actual title asynchronously
      fetchEntry(targetId).then((e) => { link.textContent = e.title; }).catch((err) => console.warn('Failed to load entry title:', err));
      li.appendChild(link);
      list.appendChild(li);
    }

    container.appendChild(list);
  }
}
