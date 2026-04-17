/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';

// --- Validation Rule Types ---

export type ValidationType =
  | 'list'
  | 'number'
  | 'integer'
  | 'date'
  | 'text-length'
  | 'custom';

export type NumberCondition =
  | 'between'
  | 'not-between'
  | 'equal'
  | 'not-equal'
  | 'greater'
  | 'greater-equal'
  | 'less'
  | 'less-equal';

export type OnInvalid = 'reject' | 'warn';

export interface ValidationRule {
  id: string;
  type: ValidationType;
  range: ValidationRange;
  condition?: NumberCondition;
  value1?: string;
  value2?: string;
  items?: string[];
  allowBlank: boolean;
  onInvalid: OnInvalid;
  inputTitle?: string;
  inputMessage?: string;
  errorTitle?: string;
  errorMessage?: string;
}

export interface ValidationRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

// --- Yjs Storage ---

const VALIDATION_MAP_KEY = 'data-validation-rules';

function getValidationMap(ydoc: Y.Doc): Y.Map<string> {
  return ydoc.getMap<string>(VALIDATION_MAP_KEY);
}

export function getValidationRules(ydoc: Y.Doc): ValidationRule[] {
  const map = getValidationMap(ydoc);
  const rules: ValidationRule[] = [];
  for (const [, raw] of map.entries()) {
    try {
      rules.push(JSON.parse(raw) as ValidationRule);
    } catch { /* skip corrupt */ }
  }
  return rules;
}

export function addValidationRule(ydoc: Y.Doc, rule: ValidationRule): void {
  const map = getValidationMap(ydoc);
  ydoc.transact(() => {
    map.set(rule.id, JSON.stringify(rule));
  });
}

export function removeValidationRule(ydoc: Y.Doc, ruleId: string): void {
  const map = getValidationMap(ydoc);
  ydoc.transact(() => {
    map.delete(ruleId);
  });
}

export function getRuleForCell(
  rules: ValidationRule[], row: number, col: number,
): ValidationRule | null {
  for (const rule of rules) {
    const r = rule.range;
    if (row >= r.startRow && row <= r.endRow && col >= r.startCol && col <= r.endCol) {
      return rule;
    }
  }
  return null;
}

export function observeValidationRules(ydoc: Y.Doc, callback: () => void): void {
  getValidationMap(ydoc).observe(callback);
}

export function generateRuleId(): string {
  return `dv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
