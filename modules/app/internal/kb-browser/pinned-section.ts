/** Contract: contracts/app/rules.md */

import type { KBEntryRecord } from './kb-api.ts';

/**
 * Separate pinned notes from unpinned entries.
 * Only applies when the current filter is set to "note" type.
 */
export function partitionPinned(
  entries: KBEntryRecord[],
  entryType: string,
): { pinned: KBEntryRecord[]; unpinned: KBEntryRecord[] } {
  if (entryType !== 'note') {
    return { pinned: [], unpinned: entries };
  }

  const pinned: KBEntryRecord[] = [];
  const unpinned: KBEntryRecord[] = [];

  for (const entry of entries) {
    if (entry.metadata?.pinned === true) {
      pinned.push(entry);
    } else {
      unpinned.push(entry);
    }
  }

  return { pinned, unpinned };
}

/** Render a "Pinned" section header element. */
export function createPinnedHeader(): HTMLElement {
  const header = document.createElement('div');
  header.className = 'kb-pinned-header';

  const icon = document.createElement('span');
  icon.className = 'kb-pinned-header__icon';
  icon.textContent = '\u{1F4CC}';

  const label = document.createElement('span');
  label.className = 'kb-pinned-header__label';
  label.textContent = 'Pinned';

  header.appendChild(icon);
  header.appendChild(label);
  return header;
}

/** Render an "Other Notes" section header. */
export function createUnpinnedHeader(): HTMLElement {
  const header = document.createElement('div');
  header.className = 'kb-pinned-header kb-pinned-header--other';

  const label = document.createElement('span');
  label.className = 'kb-pinned-header__label';
  label.textContent = 'Notes';

  header.appendChild(label);
  return header;
}
