/** Contract: contracts/app-sheets/data-validation.md */
import * as Y from 'yjs';
import type { ValidationRule } from './types.ts';
import {
  createRuleId,
  cellInRange,
  serializeRule,
  deserializeRule,
} from './types.ts';

function getRulesArray(ydoc: Y.Doc, sheetId: string): Y.Array<string> {
  return ydoc.getArray<string>(`data-validation-${sheetId}`);
}

export function getValidationRules(
  ydoc: Y.Doc,
  sheetId: string,
): ValidationRule[] {
  const arr = getRulesArray(ydoc, sheetId);
  const rules: ValidationRule[] = [];
  for (let i = 0; i < arr.length; i++) {
    const rule = deserializeRule(arr.get(i));
    if (rule) rules.push(rule);
  }
  return rules;
}

export function getRuleForCell(
  ydoc: Y.Doc,
  sheetId: string,
  row: number,
  col: number,
): ValidationRule | null {
  const rules = getValidationRules(ydoc, sheetId);
  for (const rule of rules) {
    if (cellInRange(row, col, rule.range)) return rule;
  }
  return null;
}

export function addValidationRule(
  ydoc: Y.Doc,
  sheetId: string,
  rule: Omit<ValidationRule, 'id'>,
): string {
  const id = createRuleId();
  const fullRule: ValidationRule = { ...rule, id };
  const arr = getRulesArray(ydoc, sheetId);
  ydoc.transact(() => {
    arr.insert(arr.length, [serializeRule(fullRule)]);
  });
  return id;
}

export function updateValidationRule(
  ydoc: Y.Doc,
  sheetId: string,
  ruleId: string,
  patch: Partial<ValidationRule>,
): void {
  const arr = getRulesArray(ydoc, sheetId);
  for (let i = 0; i < arr.length; i++) {
    const rule = deserializeRule(arr.get(i));
    if (rule && rule.id === ruleId) {
      const updated = { ...rule, ...patch, id: ruleId };
      ydoc.transact(() => {
        arr.delete(i, 1);
        arr.insert(i, [serializeRule(updated)]);
      });
      return;
    }
  }
}

export function removeValidationRule(
  ydoc: Y.Doc,
  sheetId: string,
  ruleId: string,
): void {
  const arr = getRulesArray(ydoc, sheetId);
  for (let i = 0; i < arr.length; i++) {
    const rule = deserializeRule(arr.get(i));
    if (rule && rule.id === ruleId) {
      ydoc.transact(() => {
        arr.delete(i, 1);
      });
      return;
    }
  }
}

export function removeAllRulesInRange(
  ydoc: Y.Doc,
  sheetId: string,
  row: number,
  col: number,
): void {
  const arr = getRulesArray(ydoc, sheetId);
  ydoc.transact(() => {
    for (let i = arr.length - 1; i >= 0; i--) {
      const rule = deserializeRule(arr.get(i));
      if (rule && cellInRange(row, col, rule.range)) {
        arr.delete(i, 1);
      }
    }
  });
}

export function observeValidationRules(
  ydoc: Y.Doc,
  sheetId: string,
  callback: () => void,
): () => void {
  const arr = getRulesArray(ydoc, sheetId);
  arr.observe(callback);
  return () => arr.unobserve(callback);
}
