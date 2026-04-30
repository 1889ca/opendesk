/** Contract: contracts/app-sheets/data-validation.md */
import type {
  ValidationRule,
  ValidationResult,
  NumberOperator,
} from './types.ts';

export function validate(
  rule: ValidationRule,
  cellValue: string,
): ValidationResult {
  if (cellValue === '' && rule.allowBlank) {
    return { valid: true };
  }

  const result = checkRule(rule, cellValue);
  if (result.valid) return result;

  return {
    valid: false,
    message:
      rule.errorMessage ||
      defaultErrorMessage(rule),
    errorStyle: rule.errorStyle,
  };
}

function checkRule(rule: ValidationRule, value: string): ValidationResult {
  switch (rule.type) {
    case 'list':
      return checkList(rule, value);
    case 'number':
      return checkNumber(rule, value, false);
    case 'integer':
      return checkNumber(rule, value, true);
    case 'date':
      return checkDate(rule, value);
    case 'text-length':
      return checkTextLength(rule, value);
    case 'custom':
      return { valid: true };
    default:
      return { valid: true };
  }
}

function checkList(rule: ValidationRule, value: string): ValidationResult {
  const items = rule.listItems || [];
  const match = items.some(
    (item) => item.trim().toLowerCase() === value.trim().toLowerCase(),
  );
  return { valid: match };
}

function checkNumber(
  rule: ValidationRule,
  value: string,
  integerOnly: boolean,
): ValidationResult {
  const num = parseFloat(value);
  if (isNaN(num)) return { valid: false };
  if (integerOnly && !Number.isInteger(num)) return { valid: false };

  const op = rule.operator || 'between';
  const v1 = parseFloat(rule.value1 || '');
  const v2 = parseFloat(rule.value2 || '');

  return { valid: compareNumber(num, op, v1, v2) };
}

function compareNumber(
  num: number,
  op: NumberOperator,
  v1: number,
  v2: number,
): boolean {
  switch (op) {
    case 'between':
      return !isNaN(v1) && !isNaN(v2) && num >= v1 && num <= v2;
    case 'not-between':
      return !isNaN(v1) && !isNaN(v2) && (num < v1 || num > v2);
    case 'equal':
      return !isNaN(v1) && num === v1;
    case 'not-equal':
      return !isNaN(v1) && num !== v1;
    case 'greater':
      return !isNaN(v1) && num > v1;
    case 'greater-equal':
      return !isNaN(v1) && num >= v1;
    case 'less':
      return !isNaN(v1) && num < v1;
    case 'less-equal':
      return !isNaN(v1) && num <= v1;
    default:
      return true;
  }
}

function checkDate(rule: ValidationRule, value: string): ValidationResult {
  const d = Date.parse(value);
  if (isNaN(d)) return { valid: false };

  const op = rule.operator || 'between';
  const d1 = Date.parse(rule.value1 || '');
  const d2 = Date.parse(rule.value2 || '');

  return { valid: compareNumber(d, op, d1, d2) };
}

function checkTextLength(
  rule: ValidationRule,
  value: string,
): ValidationResult {
  const len = value.length;
  const op = rule.operator || 'between';
  const v1 = parseFloat(rule.value1 || '');
  const v2 = parseFloat(rule.value2 || '');

  return { valid: compareNumber(len, op, v1, v2) };
}

function defaultErrorMessage(rule: ValidationRule): string {
  switch (rule.type) {
    case 'list':
      return 'Value must be one of the allowed options.';
    case 'number':
      return 'Value must be a valid number in the allowed range.';
    case 'integer':
      return 'Value must be a whole number in the allowed range.';
    case 'date':
      return 'Value must be a valid date in the allowed range.';
    case 'text-length':
      return 'Text length is outside the allowed range.';
    case 'custom':
      return 'Value does not meet the validation criteria.';
    default:
      return 'Invalid value.';
  }
}
