/** Contract: contracts/app/rules.md */

import { t } from '../i18n/index.ts';
import type { DocListState } from './doc-list-controls.ts';

export function createPaginationBar(
  state: DocListState,
  onChange: (next: Partial<DocListState>) => void,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'doc-list-pagination';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn btn-secondary doc-list-page-btn';
  prevBtn.textContent = t('docList.prevPage');
  prevBtn.disabled = state.page <= 1;
  prevBtn.addEventListener('click', () => onChange({ page: state.page - 1 }));

  const pageInfo = document.createElement('span');
  pageInfo.className = 'doc-list-page-info';
  pageInfo.textContent = t('docList.pageOf', {
    page: String(state.page),
    total: String(state.totalPages),
  });

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-secondary doc-list-page-btn';
  nextBtn.textContent = t('docList.nextPage');
  nextBtn.disabled = state.page >= state.totalPages;
  nextBtn.addEventListener('click', () => onChange({ page: state.page + 1 }));

  bar.appendChild(prevBtn);
  bar.appendChild(pageInfo);
  bar.appendChild(nextBtn);

  return bar;
}
