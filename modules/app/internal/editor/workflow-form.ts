/** Contract: contracts/app/rules.md */
import {
  TRIGGER_LABELS,
  ACTION_LABELS,
  CONDITION_REQUIRED_TRIGGERS,
} from './workflow-types.ts';
import { createWorkflow } from './workflow-api.ts';
import {
  buildDocumentVersionFilter,
  buildFieldConditionFilter,
  readConditionConfig,
} from './workflow-form-condition-fields.ts';

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
