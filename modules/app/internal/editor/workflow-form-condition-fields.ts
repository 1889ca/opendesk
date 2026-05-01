/** Contract: contracts/app/rules.md */
import type { TriggerConditionConfig, LeafTriggerConditionConfig } from './workflow-types.ts';
import { CONDITION_REQUIRED_TRIGGERS } from './workflow-types.ts';

export function buildDocumentVersionFilter(container: HTMLElement): void {
  container.innerHTML = '';

  const versionNumberInput = document.createElement('input');
  versionNumberInput.type = 'number';
  versionNumberInput.name = 'versionNumber';
  versionNumberInput.placeholder = 'Version number (e.g. 5)';
  versionNumberInput.className = 'workflow-input';
  versionNumberInput.min = '1';

  const versionNameInput = document.createElement('input');
  versionNameInput.type = 'text';
  versionNameInput.name = 'versionName';
  versionNameInput.placeholder = 'Version name (e.g. "Final Draft")';
  versionNameInput.className = 'workflow-input';

  const hint = document.createElement('p');
  hint.className = 'workflow-hint';
  hint.textContent = 'At least one of version number or version name must be specified.';

  container.append(versionNumberInput, versionNameInput, hint);
}

export function buildFieldConditionFilter(container: HTMLElement, placeholder: string): void {
  container.innerHTML = '';

  const fieldInput = document.createElement('input');
  fieldInput.type = 'text';
  fieldInput.name = 'field';
  fieldInput.placeholder = placeholder;
  fieldInput.className = 'workflow-input';
  fieldInput.required = true;

  const operatorSelect = document.createElement('select');
  operatorSelect.name = 'operator';
  operatorSelect.className = 'workflow-select';
  for (const op of [
    'equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'starts_with', 'ends_with',
  ]) {
    const opt = document.createElement('option');
    opt.value = op;
    opt.textContent = op.replace('_', ' ');
    operatorSelect.appendChild(opt);
  }

  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.name = 'value';
  valueInput.placeholder = 'Value';
  valueInput.className = 'workflow-input';
  valueInput.required = true;

  container.append(fieldInput, operatorSelect, valueInput);
}

export function readConditionConfig(
  triggerType: string,
  conditionArea: HTMLElement,
): TriggerConditionConfig | null {
  if (!CONDITION_REQUIRED_TRIGGERS.has(triggerType)) return null;

  if (triggerType === 'document.version_created') {
    const versionNumber = (conditionArea.querySelector<HTMLInputElement>('[name="versionNumber"]'))?.value;
    const versionName = (conditionArea.querySelector<HTMLInputElement>('[name="versionName"]'))?.value;
    const filter: Record<string, unknown> = {};
    if (versionNumber) filter.versionNumber = parseInt(versionNumber, 10);
    if (versionName) filter.versionName = versionName;
    if (Object.keys(filter).length === 0) return null;

    const leaf: LeafTriggerConditionConfig = { type: 'document_version', filter };
    return leaf;
  }

  if (triggerType === 'kb_entity.changed') {
    const field = (conditionArea.querySelector<HTMLInputElement>('[name="field"]'))?.value;
    const operator = (conditionArea.querySelector<HTMLSelectElement>('[name="operator"]'))?.value;
    const value = (conditionArea.querySelector<HTMLInputElement>('[name="value"]'))?.value;
    if (!field || !operator || value === undefined) return null;

    const leaf: LeafTriggerConditionConfig = { type: 'kb_entity_change', filter: { field, operator, value } };
    return leaf;
  }

  if (triggerType === 'form.submitted') {
    const field = (conditionArea.querySelector<HTMLInputElement>('[name="field"]'))?.value;
    const operator = (conditionArea.querySelector<HTMLSelectElement>('[name="operator"]'))?.value;
    const value = (conditionArea.querySelector<HTMLInputElement>('[name="value"]'))?.value;
    if (!field || !operator || value === undefined) return null;

    const leaf: LeafTriggerConditionConfig = { type: 'form_submission', filter: { field, operator, value } };
    return leaf;
  }

  return null;
}
