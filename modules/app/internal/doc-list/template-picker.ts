/** Contract: contracts/app/rules.md */

import { apiFetch } from '../shared/api-client.ts';
import { t } from '../i18n/index.ts';
import { showNameDialog } from './name-dialog.ts';
import { BUILTIN_TEMPLATES } from './builtin-templates.ts';

interface TemplateOption {
  id: string;
  name: string;
  description: string;
}

/**
 * Show a template picker modal. Fetches available templates from the API,
 * then lets the user pick one. Resolves with the selected template ID
 * (or null for blank / cancel).
 */
/** Sentinel value returned by showTemplatePicker when the user cancels without selecting. */
export const TEMPLATE_CANCELLED = Symbol('TEMPLATE_CANCELLED');

/**
 * Show the template picker modal.
 * Returns a template ID (string), null for blank, or TEMPLATE_CANCELLED if the user dismissed.
 */
export function showTemplatePicker(): Promise<string | null | typeof TEMPLATE_CANCELLED> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'template-overlay';

    const modal = document.createElement('div');
    modal.className = 'template-modal';

    const title = document.createElement('h2');
    title.className = 'template-modal-title';
    title.textContent = t('templates.title');
    modal.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'template-grid';
    grid.textContent = t('templates.loading');
    modal.appendChild(grid);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function cancel() {
      overlay.remove();
      resolve(TEMPLATE_CANCELLED);
    }

    function select(templateId: string | null) {
      overlay.remove();
      resolve(templateId);
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cancel();
    });

    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onEsc);
        cancel();
      }
    });

    fetchTemplates().then((templates) => {
      grid.textContent = '';
      renderCards(grid, templates, select);
    }).catch(() => {
      grid.textContent = t('templates.loadFailed');
    });
  });
}

async function fetchTemplates(): Promise<TemplateOption[]> {
  const builtins: TemplateOption[] = BUILTIN_TEMPLATES.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
  }));
  try {
    const res = await apiFetch('/api/templates');
    const apiTemplates: TemplateOption[] = res.ok ? await res.json() : [];
    return [
      ...builtins,
      ...apiTemplates.filter(t => t.name.toLowerCase() !== 'blank'),
    ];
  } catch {
    return builtins;
  }
}

function renderCards(
  container: HTMLElement,
  templates: TemplateOption[],
  onSelect: (id: string | null) => void,
) {
  // "Blank" is always first — uses null to signal no template
  const blankCard = createCard(
    t('templates.blank'),
    t('templates.blankDesc'),
    () => onSelect(null),
  );
  blankCard.classList.add('template-card-blank');
  container.appendChild(blankCard);

  for (const tpl of templates) {
    // Skip if the template is named "Blank" (we show our own)
    if (tpl.name.toLowerCase() === 'blank') continue;
    const card = createCard(tpl.name, tpl.description, () => onSelect(tpl.id));
    container.appendChild(card);
  }
}

function createCard(
  name: string,
  description: string,
  onClick: () => void,
): HTMLElement {
  const card = document.createElement('button');
  card.className = 'template-card';

  const nameEl = document.createElement('span');
  nameEl.className = 'template-card-name';
  nameEl.textContent = name;

  const descEl = document.createElement('span');
  descEl.className = 'template-card-desc';
  descEl.textContent = description;

  card.appendChild(nameEl);
  card.appendChild(descEl);
  card.addEventListener('click', onClick);
  return card;
}

/**
 * Create a document, optionally from a template.
 * Returns the new document's ID, or null if the user cancelled.
 */
export async function createDocumentFromTemplate(documentType: 'text' | 'spreadsheet' | 'presentation' = 'text'): Promise<string | null> {
  const templateResult = await showTemplatePicker();
  if (templateResult === TEMPLATE_CANCELLED) return null;
  const templateId = templateResult;

  const labelKey =
    documentType === 'spreadsheet' ? 'docList.spreadsheetTitlePrompt' :
    documentType === 'presentation' ? 'docList.presentationTitlePrompt' :
    'docList.titlePrompt';
  const titleText = await showNameDialog(labelKey);
  if (!titleText) return null;

  const isBuiltin = templateId?.startsWith('builtin:');
  const url = (!templateId || isBuiltin)
    ? '/api/documents'
    : `/api/documents?templateId=${encodeURIComponent(templateId)}`;

  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: titleText, documentType }),
  });

  if (!res.ok) throw new Error('Failed to create document');
  const doc = await res.json();

  if (isBuiltin) {
    const tpl = BUILTIN_TEMPLATES.find(t => t.id === templateId);
    if (tpl) {
      sessionStorage.setItem(`opendesk-template-${doc.id}`, tpl.html);
    }
  }

  return doc.id;
}
