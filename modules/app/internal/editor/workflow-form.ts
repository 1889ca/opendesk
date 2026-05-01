/** Contract: contracts/app/rules.md */
import {
  TRIGGER_LABELS,
  ACTION_LABELS,
  CONDITION_REQUIRED_TRIGGERS,
  type TriggerConditionConfig,
  type LeafTriggerConditionConfig,
} from './workflow-types.ts';
import { createWorkflow } from './workflow-api.ts';

/** Build the condition filter fields for document_version triggers. */
function buildDocumentVersionFilter(container: HTMLElement): void {
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

/** Build a simple field/operator/value condition row for KB entity and form triggers. */
function buildFieldConditionFilter(container: HTMLElement, placeholder: string): void {
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

/** Read trigger condition config from the condition area DOM. */
function readConditionConfig(
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

    const leaf: LeafTriggerConditionConfig = {
      type: 'kb_entity_change',
      filter: { field, operator, value },
    };
    return leaf;
  }

  if (triggerType === 'form.submitted') {
    const field = (conditionArea.querySelector<HTMLInputElement>('[name="field"]'))?.value;
    const operator = (conditionArea.querySelector<HTMLSelectElement>('[name="operator"]'))?.value;
    const value = (conditionArea.querySelector<HTMLInputElement>('[name="value"]'))?.value;
    if (!field || !operator || value === undefined) return null;

    const leaf: LeafTriggerConditionConfig = {
      type: 'form_submission',
      filter: { field, operator, value },
    };
    return leaf;
  }

  return null;
}

export function buildCreateForm(docId: string, onCreated: () => void): HTMLElement {
  const form = document.createElement('form');
  form.className = 'workflow-create-form';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Workflow name';
  nameInput.required = true;
  nameInput.maxLength = 200;
  nameInput.className = 'workflow-input';

  const triggerSelect = document.createElement('select');
  triggerSelect.className = 'workflow-select';
  for (const [value, label] of Object.entries(TRIGGER_LABELS)) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    triggerSelect.appendChild(opt);
  }

  const conditionArea = document.createElement('div');
  conditionArea.className = 'workflow-condition-area';

  function updateConditionFields(): void {
    const trigger = triggerSelect.value;
    conditionArea.innerHTML = '';
    if (!CONDITION_REQUIRED_TRIGGERS.has(trigger)) return;

    const label = document.createElement('p');
    label.className = 'workflow-section-label';
    label.textContent = 'Trigger Condition';
    conditionArea.appendChild(label);

    if (trigger === 'document.version_created') {
      buildDocumentVersionFilter(conditionArea);
    } else if (trigger === 'kb_entity.changed') {
      buildFieldConditionFilter(conditionArea, 'Field path (e.g. status, content.score)');
    } else if (trigger === 'form.submitted') {
      buildFieldConditionFilter(conditionArea, 'Answer field path (e.g. score, answers.region)');
    }
  }

  const actionSelect = document.createElement('select');
  actionSelect.className = 'workflow-select';
  for (const [value, label] of Object.entries(ACTION_LABELS)) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    actionSelect.appendChild(opt);
  }

  const configArea = document.createElement('div');
  configArea.className = 'workflow-config-area';

  function updateConfigFields(): void {
    configArea.innerHTML = '';
    const action = actionSelect.value;
    if (action === 'webhook') {
      const urlInput = document.createElement('input');
      urlInput.type = 'url';
      urlInput.placeholder = 'Webhook URL (https://...)';
      urlInput.required = true;
      urlInput.className = 'workflow-input';
      urlInput.name = 'url';
      configArea.appendChild(urlInput);
    } else if (action === 'export') {
      const formatSelect = document.createElement('select');
      formatSelect.className = 'workflow-select';
      formatSelect.name = 'format';
      for (const fmt of ['docx', 'odt', 'pdf']) {
        const opt = document.createElement('option');
        opt.value = fmt;
        opt.textContent = fmt.toUpperCase();
        formatSelect.appendChild(opt);
      }
      configArea.appendChild(formatSelect);
    } else if (action === 'notify') {
      const msgInput = document.createElement('input');
      msgInput.type = 'text';
      msgInput.placeholder = 'Notification message';
      msgInput.required = true;
      msgInput.className = 'workflow-input';
      msgInput.name = 'message';
      configArea.appendChild(msgInput);
    }
  }

  triggerSelect.addEventListener('change', () => {
    updateConditionFields();
    updateConfigFields();
  });
  actionSelect.addEventListener('change', updateConfigFields);

  updateConditionFields();
  updateConfigFields();

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'workflow-submit-btn';
  submitBtn.textContent = 'Create Workflow';

  const errorEl = document.createElement('div');
  errorEl.className = 'workflow-form-error';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const triggerType = triggerSelect.value;
    const triggerConditions = readConditionConfig(triggerType, conditionArea);

    if (CONDITION_REQUIRED_TRIGGERS.has(triggerType) && !triggerConditions) {
      errorEl.textContent = 'A condition filter is required for this trigger type.';
      return;
    }

    const actionType = actionSelect.value;
    let actionConfig: Record<string, unknown> = {};
    if (actionType === 'webhook') {
      const urlEl = configArea.querySelector<HTMLInputElement>('[name="url"]');
      actionConfig = { url: urlEl?.value ?? '' };
    } else if (actionType === 'export') {
      const fmtEl = configArea.querySelector<HTMLSelectElement>('[name="format"]');
      actionConfig = { format: fmtEl?.value ?? 'pdf' };
    } else if (actionType === 'notify') {
      const msgEl = configArea.querySelector<HTMLInputElement>('[name="message"]');
      actionConfig = { message: msgEl?.value ?? '' };
    }

    const result = await createWorkflow({
      name: nameInput.value,
      documentId: docId,
      triggerType,
      triggerConditions: triggerConditions ?? undefined,
      actionType,
      actionConfig,
    });

    if (result) {
      form.reset();
      updateConditionFields();
      updateConfigFields();
      onCreated();
    } else {
      errorEl.textContent = 'Failed to create workflow';
    }
  });

  form.append(nameInput, triggerSelect, conditionArea, actionSelect, configArea, errorEl, submitBtn);
  return form;
}
