/** Contract: contracts/app/rules.md */

import { resolveReference } from './kb-api.ts';

export interface RefInsertionMeta {
  entryId: string;
  version: number | 'latest';
  insertedVersion: number;
}

/**
 * Create a "source updated" indicator element for a KB reference.
 * For pinned references: always shows as "pinned" (stable).
 * For "latest" references: checks if the current version differs from
 * the version that was active when the reference was inserted.
 */
export function createRefIndicator(meta: RefInsertionMeta): HTMLElement {
  const el = document.createElement('span');
  el.className = 'kb-ref-indicator';

  if (meta.version !== 'latest') {
    el.classList.add('kb-ref-pinned');
    el.textContent = `Pinned v${meta.version}`;
    el.title = `This reference is pinned to version ${meta.version}`;
    return el;
  }

  // For "latest" references, check asynchronously
  el.classList.add('kb-ref-checking');
  el.textContent = 'Checking...';

  checkForUpdates(el, meta);
  return el;
}

async function checkForUpdates(el: HTMLElement, meta: RefInsertionMeta): Promise<void> {
  try {
    const resolved = await resolveReference(meta.entryId, 'latest');
    el.classList.remove('kb-ref-checking');

    if (resolved.version > meta.insertedVersion) {
      el.classList.add('kb-ref-updated');
      el.textContent = `Source updated (v${meta.insertedVersion} -> v${resolved.version})`;
      el.title = 'The source entry has been updated since this reference was inserted';
    } else {
      el.classList.add('kb-ref-current');
      el.textContent = 'Up to date';
      el.title = 'This reference tracks the latest version';
    }
  } catch {
    el.classList.remove('kb-ref-checking');
    el.classList.add('kb-ref-error');
    el.textContent = 'Could not verify';
  }
}

/**
 * Build reference metadata to store when inserting a KB reference.
 * The caller chooses "pin" or "latest" at insertion time.
 */
export function buildRefMeta(
  entryId: string,
  currentVersion: number,
  pinned: boolean,
): RefInsertionMeta {
  return {
    entryId,
    version: pinned ? currentVersion : 'latest',
    insertedVersion: currentVersion,
  };
}
