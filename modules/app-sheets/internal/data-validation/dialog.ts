/** Contract: contracts/app-sheets/data-validation.md */
import type {
  ValidationType,
  NumberOperator,
  ErrorStyle,
  CellRange,
  ValidationRule,
} from './types.ts';
import { buildDialogHTML } from './dialog-html.ts';

export interface DialogCallbacks {
  onSave: (rule: Omit<ValidationRule, 'id'>) => void;
  onRemove: () => void;
  onCancel: () => void;
}

export function openValidationDialog(
  range: CellRange,
  existing: ValidationRule | null,
  callbacks: DialogCallbacks,
): void {
  const overlay = document.createElement('div');
  overlay.className = 'dv-dialog-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'dv-dialog';

  dialog.innerHTML = buildDialogHTML(existing);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const form = dialog.querySelector<HTMLFormElement>('.dv-dialog-form')!;
  const typeSelect = form.querySelector<HTMLSelectElement>('[name="type"]')!;
  const operatorRow = dialog.querySelector<HTMLElement>('.dv-operator-row')!;
  const listRow = dialog.querySelector<HTMLElement>('.dv-list-row')!;
  const value1Row = dialog.querySelector<HTMLElement>('.dv-value1-row')!;
  const value2Row = dialog.querySelector<HTMLElement>('.dv-value2-row')!;
  const operatorSelect = form.querySelector<HTMLSelectElement>('[name="operator"]')!;

  function updateVisibility() {
    const t = typeSelect.value as ValidationType;
    const op = operatorSelect.value as NumberOperator;
    const showOp = t !== 'list' && t !== 'custom';
    const showList = t === 'list';
    const needsTwo = op === 'between' || op === 'not-between';

    operatorRow.style.display = showOp ? '' : 'none';
    listRow.style.display = showList ? '' : 'none';
    value1Row.style.display = showOp ? '' : 'none';
    value2Row.style.display = showOp && needsTwo ? '' : 'none';
  }

  typeSelect.addEventListener('change', updateVisibility);
  operatorSelect.addEventListener('change', updateVisibility);
  updateVisibility();

  dialog.querySelector('.dv-dialog-cancel')!.addEventListener('click', () => {
    overlay.remove();
    callbacks.onCancel();
  });

  dialog.querySelector('.dv-dialog-remove')?.addEventListener('click', () => {
    overlay.remove();
    callbacks.onRemove();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const rule = formToRule(fd, range);
    overlay.remove();
    callbacks.onSave(rule);
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      callbacks.onCancel();
    }
  });
}

function formToRule(
  fd: FormData,
  range: CellRange,
): Omit<ValidationRule, 'id'> {
  const type = fd.get('type') as ValidationType;
  const listStr = (fd.get('listItems') as string) || '';

  return {
    type,
    range,
    operator: (fd.get('operator') as NumberOperator) || 'between',
    value1: (fd.get('value1') as string) || '',
    value2: (fd.get('value2') as string) || '',
    listItems: type === 'list'
      ? listStr.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined,
    errorStyle: (fd.get('errorStyle') as ErrorStyle) || 'reject',
    errorTitle: (fd.get('errorTitle') as string) || '',
    errorMessage: (fd.get('errorMessage') as string) || '',
    inputTitle: (fd.get('inputTitle') as string) || '',
    inputMessage: (fd.get('inputMessage') as string) || '',
    allowBlank: fd.get('allowBlank') === 'on',
  };
}
