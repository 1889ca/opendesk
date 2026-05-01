/** Contract: contracts/app/rules.md */

/**
 * Editor page controller — handles title saving, share dialog, and dropdown setup.
 * Export and import handlers are in editor-page-exports.ts.
 */

import { getDocumentId } from '../shared/identity.ts';
import { setupShareDialog } from './share-dialog.ts';
import { setupTitleSync } from '../shared/title-sync.ts';
import { setupClientExports, setupCollaboraExports, setupImport } from './editor-page-exports.ts';

function setupExportDropdown(): void {
  const toggle = document.querySelector<HTMLButtonElement>('.export-dropdown-toggle');
  const menu = document.querySelector<HTMLElement>('.export-dropdown-menu');
  if (!toggle || !menu) return;

  function openMenu(): void {
    menu!.hidden = false;
    toggle!.setAttribute('aria-expanded', 'true');
  }

  function closeMenu(): void {
    menu!.hidden = true;
    toggle!.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.hidden) { openMenu(); } else { closeMenu(); }
  });

  menu.addEventListener('click', () => { closeMenu(); });

  document.addEventListener('click', (e) => {
    if (!menu.hidden && !toggle.contains(e.target as Node)) { closeMenu(); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { closeMenu(); toggle.focus(); }
  });
}

function setupLayoutDropdown(): void {
  const toggle = document.querySelector<HTMLButtonElement>('.layout-dropdown-toggle');
  const menu = document.querySelector<HTMLElement>('.layout-dropdown-menu');
  if (!toggle || !menu) return;

  function openMenu(): void {
    menu!.hidden = false;
    toggle!.setAttribute('aria-expanded', 'true');
  }

  function closeMenu(): void {
    menu!.hidden = true;
    toggle!.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.hidden) { openMenu(); } else { closeMenu(); }
  });

  menu.addEventListener('click', () => { closeMenu(); });

  document.addEventListener('click', (e) => {
    if (!menu.hidden && !toggle.contains(e.target as Node)) { closeMenu(); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { closeMenu(); toggle.focus(); }
  });
}

export function initEditorPage(): void {
  const docId = getDocumentId();
  if (docId === 'default') {
    window.location.href = '/';
    return;
  }
  setupTitleSync(docId);
  setupClientExports();
  setupCollaboraExports(docId);
  setupImport(docId);
  setupShareDialog(docId);
  setupExportDropdown();
  setupLayoutDropdown();
}
