/** Contract: contracts/forms/rules.md */

import type { QuestionType, FormDefinition } from '../contract.ts';

export interface SidebarCallbacks {
  onAddQuestion: (type: QuestionType) => void;
  getForm: () => FormDefinition | null;
  onSettingChange: (key: 'anonymous' | 'single_response', value: boolean) => void;
}

const QUESTION_TYPES: Array<{ type: QuestionType; icon: string; label: string }> = [
  { type: 'short_text', icon: '📝', label: 'Short text' },
  { type: 'long_text', icon: '📄', label: 'Long text' },
  { type: 'single_choice', icon: '🔘', label: 'Single choice' },
  { type: 'multi_choice', icon: '☑️', label: 'Checkboxes' },
  { type: 'scale', icon: '⭐', label: 'Scale' },
  { type: 'date', icon: '📅', label: 'Date' },
  { type: 'file_upload', icon: '📎', label: 'File upload' },
  { type: 'email', icon: '✉️', label: 'Email' },
  { type: 'number', icon: '#️⃣', label: 'Number' },
];

export function buildSidebar(cbs: SidebarCallbacks): HTMLElement {
  const sidebar = document.createElement('aside');
  sidebar.className = 'form-builder-sidebar';

  // ── Add question section ──
  const addTitle = document.createElement('h3');
  addTitle.className = 'form-sidebar-section-title';
  addTitle.textContent = 'Add question';

  const grid = document.createElement('div');
  grid.className = 'form-add-question-grid';

  for (const { type, icon, label } of QUESTION_TYPES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'form-add-question-btn';
    btn.setAttribute('aria-label', `Add ${label} question`);

    const iconEl = document.createElement('span');
    iconEl.className = 'form-add-question-btn-icon';
    iconEl.textContent = icon;

    btn.appendChild(iconEl);
    btn.appendChild(document.createTextNode(label));
    btn.addEventListener('click', () => cbs.onAddQuestion(type));
    grid.appendChild(btn);
  }

  sidebar.appendChild(addTitle);
  sidebar.appendChild(grid);

  // ── Settings section ──
  const settingsTitle = document.createElement('h3');
  settingsTitle.className = 'form-sidebar-section-title';
  settingsTitle.style.marginTop = '1rem';
  settingsTitle.textContent = 'Settings';

  const settingsGroup = document.createElement('div');
  settingsGroup.className = 'form-settings-group';

  settingsGroup.appendChild(buildToggle(
    'Allow anonymous',
    'Respondents can submit without signing in.',
    () => cbs.getForm()?.anonymous ?? false,
    (v) => cbs.onSettingChange('anonymous', v),
  ));

  settingsGroup.appendChild(buildToggle(
    'One response per person',
    'Authenticated respondents can only submit once.',
    () => cbs.getForm()?.single_response ?? false,
    (v) => cbs.onSettingChange('single_response', v),
  ));

  sidebar.appendChild(settingsTitle);
  sidebar.appendChild(settingsGroup);

  return sidebar;
}

function buildToggle(
  label: string,
  sublabel: string,
  getValue: () => boolean,
  setValue: (v: boolean) => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'form-settings-row';

  const labelCol = document.createElement('div');
  const labelEl = document.createElement('div');
  labelEl.className = 'form-settings-label';
  labelEl.textContent = label;
  const sublabelEl = document.createElement('div');
  sublabelEl.className = 'form-settings-sublabel';
  sublabelEl.textContent = sublabel;
  labelCol.appendChild(labelEl);
  labelCol.appendChild(sublabelEl);

  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'form-toggle';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = getValue();
  checkbox.addEventListener('change', () => setValue(checkbox.checked));

  const slider = document.createElement('span');
  slider.className = 'form-toggle-slider';

  toggleLabel.appendChild(checkbox);
  toggleLabel.appendChild(slider);

  row.appendChild(labelCol);
  row.appendChild(toggleLabel);
  return row;
}
