/** Contract: contracts/app/shell.md */

/**
 * Placeholder view for editor types not yet implemented (spreadsheet, presentation).
 * Shows a friendly "coming soon" message with a link back to the dashboard.
 */

import { t } from '../i18n/index.ts';

const TYPE_LABELS: Record<string, string> = {
  spreadsheet: 'Spreadsheet',
  presentation: 'Presentation',
};

export function mount(container: HTMLElement, params: Record<string, string>): void {
  const type = params.type || 'unknown';
  const label = TYPE_LABELS[type] || type;

  const wrapper = document.createElement('div');
  wrapper.className = 'placeholder-view';

  const heading = document.createElement('h2');
  heading.textContent = `${label} Editor`;

  const message = document.createElement('p');
  message.textContent = `The ${label.toLowerCase()} editor is not yet available. This feature is on the OpenDesk roadmap.`;

  const backLink = document.createElement('a');
  backLink.href = '/';
  backLink.className = 'btn btn-primary';
  backLink.textContent = t('editor.backToDocuments');

  wrapper.appendChild(heading);
  wrapper.appendChild(message);
  wrapper.appendChild(backLink);
  container.appendChild(wrapper);
}

export function unmount(): void {
  // No resources to clean up
}
