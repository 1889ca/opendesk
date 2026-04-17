/** Contract: contracts/app-sheets/rules.md */
import type {
  ValidationRule, ValidationResult, NumberCondition,
} from './data-validation-rules.ts';

export function validate(rule: ValidationRule, cellValue: string): ValidationResult {
  if (cellValue === '' && rule.allowBlank) {
    return { valid: true };
  }

  switch (rule.type) {
    case 'list': return validateList(rule, cellValue);
    case 'number': return validateNumber(rule, cellValue, false);
    case 'integer': return validateNumber(rule, cellValue, true);
    case 'date': return validateDate(rule, cellValue);
    case 'text-length': return validateTextLength(rule, cellValue);
    case 'custom': return validateCustom(rule, cellValue);
    default: return { valid: true };
  }
}

function validateList(rule: ValidationRule, value: string): ValidationResult {
  const items = rule.items ?? [];
  if (items.includes(value)) return { valid: true };
  return {
    valid: false,
    message: rule.errorMessage ?? `Value must be one of: ${items.join(', ')}`,
  };
}

function validateNumber(
  rule: ValidationRule, value: string, requireInt: boolean,
): ValidationResult {
  const num = Number(value);
  if (isNaN(num)) {
    return { valid: false, message: rule.errorMessage ?? 'Value must be a number' };
  }
  if (requireInt && !Number.isInteger(num)) {
    return { valid: false, message: rule.errorMessage ?? 'Value must be a whole number' };
  }
  if (!rule.condition) return { valid: true };
  if (!checkCondition(rule.condition, num, rule.value1, rule.value2)) {
    return { valid: false, message: rule.errorMessage ?? buildCondMessage(rule) };
  }
  return { valid: true };
}

function validateDate(rule: ValidationRule, value: string): ValidationResult {
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    return { valid: false, message: rule.errorMessage ?? 'Value must be a valid date' };
  }
  if (!rule.condition || !rule.value1) return { valid: true };
  const ts = d.getTime();
  if (!checkCondition(rule.condition, ts, rule.value1, rule.value2)) {
    return { valid: false, message: rule.errorMessage ?? buildCondMessage(rule) };
  }
  return { valid: true };
}

function validateTextLength(rule: ValidationRule, value: string): ValidationResult {
  if (!rule.condition) return { valid: true };
  if (!checkCondition(rule.condition, value.length, rule.value1, rule.value2)) {
    return { valid: false, message: rule.errorMessage ?? buildCondMessage(rule) };
  }
  return { valid: true };
}

function validateCustom(rule: ValidationRule, value: string): ValidationResult {
  if (!rule.value1) return { valid: true };
  try {
    const regex = new RegExp(rule.value1);
    if (regex.test(value)) return { valid: true };
  } catch {
    return { valid: false, message: 'Invalid validation pattern' };
  }
  return { valid: false, message: rule.errorMessage ?? 'Value does not match pattern' };
}

function parseVal(s: string | undefined): number {
  return s !== undefined ? Number(s) : NaN;
}

function checkCondition(
  cond: NumberCondition, value: number, v1?: string, v2?: string,
): boolean {
  const a = parseVal(v1);
  const b = parseVal(v2);
  switch (cond) {
    case 'between': return !isNaN(a) && !isNaN(b) && value >= a && value <= b;
    case 'not-between': return !isNaN(a) && !isNaN(b) && (value < a || value > b);
    case 'equal': return !isNaN(a) && value === a;
    case 'not-equal': return !isNaN(a) && value !== a;
    case 'greater': return !isNaN(a) && value > a;
    case 'greater-equal': return !isNaN(a) && value >= a;
    case 'less': return !isNaN(a) && value < a;
    case 'less-equal': return !isNaN(a) && value <= a;
    default: return true;
  }
}

function buildCondMessage(rule: ValidationRule): string {
  const t = rule.type === 'text-length' ? 'Text length' : 'Value';
  switch (rule.condition) {
    case 'between': return `${t} must be between ${rule.value1} and ${rule.value2}`;
    case 'not-between': return `${t} must not be between ${rule.value1} and ${rule.value2}`;
    case 'equal': return `${t} must equal ${rule.value1}`;
    case 'not-equal': return `${t} must not equal ${rule.value1}`;
    case 'greater': return `${t} must be greater than ${rule.value1}`;
    case 'greater-equal': return `${t} must be at least ${rule.value1}`;
    case 'less': return `${t} must be less than ${rule.value1}`;
    case 'less-equal': return `${t} must be at most ${rule.value1}`;
    default: return 'Invalid value';
  }
}
