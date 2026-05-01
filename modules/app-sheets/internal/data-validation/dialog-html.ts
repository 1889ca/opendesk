/** Contract: contracts/app-sheets/data-validation.md */
import type { ValidationType, NumberOperator, ValidationRule } from './types.ts';

const TYPE_LABELS: Record<ValidationType, string> = {
  list: 'List of items',
  number: 'Number',
  integer: 'Whole number',
  date: 'Date',
  'text-length': 'Text length',
  custom: 'Custom formula',
};

const OPERATOR_LABELS: Record<NumberOperator, string> = {
  between: 'between',
  'not-between': 'not between',
  equal: 'equal to',
  'not-equal': 'not equal to',
  greater: 'greater than',
  'greater-equal': 'greater than or equal to',
  less: 'less than',
  'less-equal': 'less than or equal to',
};

export function buildDialogHTML(existing: ValidationRule | null): string {
  const v = existing;
  return `
<form class="dv-dialog-form">
  <h3 class="dv-dialog-title">Data Validation</h3>
  <label class="dv-field">
    <span>Allow</span>
    ${buildSelect('type', TYPE_LABELS, v?.type || 'list')}
  </label>
  <div class="dv-operator-row dv-field">
    <label>
      <span>Data</span>
      ${buildSelect('operator', OPERATOR_LABELS, v?.operator || 'between')}
    </label>
  </div>
  <div class="dv-list-row dv-field">
    <label>
      <span>Items (comma-separated)</span>
      <input name="listItems" class="dv-input" value="${esc(v?.listItems?.join(', ') || '')}" />
    </label>
  </div>
  <div class="dv-value1-row dv-field">
    <label><span>Minimum / Value</span>
      <input name="value1" class="dv-input" value="${esc(v?.value1 || '')}" />
    </label>
  </div>
  <div class="dv-value2-row dv-field">
    <label><span>Maximum</span>
      <input name="value2" class="dv-input" value="${esc(v?.value2 || '')}" />
    </label>
  </div>
  <label class="dv-field dv-checkbox-field">
    <input type="checkbox" name="allowBlank" ${v?.allowBlank ? 'checked' : ''} />
    <span>Allow blank</span>
  </label>
  <details class="dv-section">
    <summary>Input message</summary>
    <label class="dv-field"><span>Title</span>
      <input name="inputTitle" class="dv-input" value="${esc(v?.inputTitle || '')}" />
    </label>
    <label class="dv-field"><span>Message</span>
      <textarea name="inputMessage" class="dv-input" rows="2">${esc(v?.inputMessage || '')}</textarea>
    </label>
  </details>
  <details class="dv-section">
    <summary>Error alert</summary>
    <label class="dv-field"><span>Style</span>
      ${buildSelect('errorStyle', { reject: 'Stop', warning: 'Warning', info: 'Information' }, v?.errorStyle || 'reject')}
    </label>
    <label class="dv-field"><span>Title</span>
      <input name="errorTitle" class="dv-input" value="${esc(v?.errorTitle || '')}" />
    </label>
    <label class="dv-field"><span>Message</span>
      <textarea name="errorMessage" class="dv-input" rows="2">${esc(v?.errorMessage || '')}</textarea>
    </label>
  </details>
  <div class="dv-dialog-actions">
    ${v ? '<button type="button" class="dv-dialog-remove dv-btn dv-btn-danger">Remove</button>' : ''}
    <span class="dv-spacer"></span>
    <button type="button" class="dv-dialog-cancel dv-btn">Cancel</button>
    <button type="submit" class="dv-dialog-save dv-btn dv-btn-primary">Save</button>
  </div>
</form>`;
}

function buildSelect(
  name: string,
  options: Record<string, string>,
  selected: string,
): string {
  const opts = Object.entries(options)
    .map(([k, label]) => `<option value="${k}"${k === selected ? ' selected' : ''}>${label}</option>`)
    .join('');
  return `<select name="${name}" class="dv-select">${opts}</select>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
