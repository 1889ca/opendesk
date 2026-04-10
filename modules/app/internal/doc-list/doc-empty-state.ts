/** Contract: contracts/app/rules.md */

/**
 * Empty-state rendering for the document list (issue #182).
 */

import { t } from '../i18n/index.ts';
import { getCurrentFolderId } from './folder-list.ts';

const EMPTY_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false" class="empty-state-icon">'
  + '<rect x="10" y="8" width="38" height="48" rx="4" ry="4" fill="none" stroke="currentColor" stroke-width="3"/>'
  + '<line x1="18" y1="22" x2="40" y2="22" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>'
  + '<line x1="18" y1="30" x2="40" y2="30" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>'
  + '<line x1="18" y1="38" x2="32" y2="38" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>'
  + '</svg>';


export function renderEmptyState(listEl: HTMLElement, onNewDocument?: () => void): void {
  const emptyEl = document.createElement('div');
  emptyEl.className = 'doc-list-empty';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'empty-state-icon-wrap';
  iconWrap.innerHTML = EMPTY_ICON_SVG;

  const key = getCurrentFolderId() ? 'folders.empty' : 'docList.noDocuments';
  const titleP = document.createElement('p');
  titleP.className = 'empty-title';
  titleP.textContent = t(key);

  const subtitleP = document.createElement('p');
  subtitleP.className = 'empty-subtitle';
  subtitleP.textContent = t('docList.noDocumentsSubtitle');

  emptyEl.append(iconWrap, titleP, subtitleP);

  if (onNewDocument && !getCurrentFolderId()) {
    const newBtn = document.createElement('button');
    newBtn.className = 'btn btn-primary empty-state-new-btn';
    newBtn.textContent = t('docList.newDocument');
    newBtn.addEventListener('click', () => onNewDocument());
    emptyEl.appendChild(newBtn);
  }

  listEl.appendChild(emptyEl);
}
