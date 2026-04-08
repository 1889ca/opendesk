/** Contract: contracts/workflow/rules.md */
import type { WorkflowNode } from './types.ts';

type UpdateCb = (nodeId: string, changes: Partial<WorkflowNode>) => void;

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export function labeledInput(
  labelText: string,
  value: string,
  onChange: (val: string) => void,
): HTMLElement {
  const wrap = el('label', 'wf-prop-field');
  wrap.appendChild(el('span', 'wf-prop-label', labelText));
  const input = document.createElement('input');
  input.className = 'wf-prop-input';
  input.value = value;
  input.addEventListener('input', () => onChange(input.value));
  wrap.appendChild(input);
  return wrap;
}

export function labeledSelect(
  labelText: string,
  options: { value: string; label: string }[],
  current: string,
  onChange: (val: string) => void,
): HTMLElement {
  const wrap = el('label', 'wf-prop-field');
  wrap.appendChild(el('span', 'wf-prop-label', labelText));
  const select = document.createElement('select');
  select.className = 'wf-prop-input';
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === current) o.selected = true;
    select.appendChild(o);
  }
  select.addEventListener('change', () => onChange(select.value));
  wrap.appendChild(select);
  return wrap;
}

export function renderTriggerConfig(
  container: HTMLElement,
  node: WorkflowNode,
  onUpdate: UpdateCb,
) {
  container.appendChild(
    labeledSelect('Trigger type', [
      { value: 'document.updated', label: 'Document Updated' },
      { value: 'document.exported', label: 'Document Exported' },
      { value: 'grant.created', label: 'Grant Created' },
      { value: 'grant.revoked', label: 'Grant Revoked' },
    ], (node.config.triggerType as string) ?? 'document.updated', (val) => {
      onUpdate(node.id, { config: { ...node.config, triggerType: val } });
    }),
  );
}

export function renderConditionConfig(
  container: HTMLElement,
  node: WorkflowNode,
  onUpdate: UpdateCb,
) {
  const cfg = node.config as { field?: string; operator?: string; value?: string };

  container.appendChild(labeledInput('Field', cfg.field ?? '', (val) => {
    onUpdate(node.id, { config: { ...node.config, field: val } });
  }));

  container.appendChild(labeledSelect('Operator', [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'not contains' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'greater_than', label: 'greater than' },
    { value: 'less_than', label: 'less than' },
    { value: 'includes', label: 'includes' },
    { value: 'not_includes', label: 'not includes' },
  ], cfg.operator ?? 'equals', (val) => {
    onUpdate(node.id, { config: { ...node.config, operator: val } });
  }));

  container.appendChild(labeledInput('Value', cfg.value ?? '', (val) => {
    onUpdate(node.id, { config: { ...node.config, value: val } });
  }));
}

export function renderActionConfig(
  container: HTMLElement,
  node: WorkflowNode,
  onUpdate: UpdateCb,
) {
  const actionType = (node.config.actionType as string) ?? 'notify';
  container.appendChild(labeledSelect('Action type', [
    { value: 'webhook', label: 'Webhook' },
    { value: 'export', label: 'Export' },
    { value: 'notify', label: 'Notify' },
    { value: 'set_metadata', label: 'Set Metadata' },
    { value: 'move_to_folder', label: 'Move to Folder' },
    { value: 'change_status', label: 'Change Status' },
    { value: 'send_email', label: 'Send Email' },
  ], actionType, (val) => {
    onUpdate(node.id, { config: { ...node.config, actionType: val, actionConfig: {} } });
  }));

  const actionConfig = (node.config.actionConfig as Record<string, string>) ?? {};
  const fields = getActionFields(actionType);
  for (const f of fields) {
    container.appendChild(labeledInput(f.label, actionConfig[f.key] ?? '', (val) => {
      onUpdate(node.id, {
        config: { ...node.config, actionConfig: { ...actionConfig, [f.key]: val } },
      });
    }));
  }
}

function getActionFields(actionType: string): { key: string; label: string }[] {
  switch (actionType) {
    case 'webhook': return [{ key: 'url', label: 'URL' }];
    case 'export': return [{ key: 'format', label: 'Format (docx/odt/pdf)' }];
    case 'notify': return [{ key: 'message', label: 'Message' }];
    case 'set_metadata': return [
      { key: 'key', label: 'Metadata key' },
      { key: 'value', label: 'Metadata value' },
    ];
    case 'move_to_folder': return [{ key: 'folderId', label: 'Folder ID' }];
    case 'change_status': return [{ key: 'status', label: 'New status' }];
    case 'send_email': return [
      { key: 'to', label: 'To (email)' },
      { key: 'subject', label: 'Subject' },
      { key: 'body', label: 'Body' },
    ];
    default: return [];
  }
}
