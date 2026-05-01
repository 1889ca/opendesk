/** Contract: contracts/app-sheets/data-validation.md */

export type ValidationType =
  | 'list'
  | 'number'
  | 'integer'
  | 'date'
  | 'text-length'
  | 'custom';

export type NumberOperator =
  | 'between'
  | 'not-between'
  | 'equal'
  | 'not-equal'
  | 'greater'
  | 'greater-equal'
  | 'less'
  | 'less-equal';

export type ErrorStyle = 'reject' | 'warning' | 'info';

export interface CellRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface ValidationRule {
  id: string;
  type: ValidationType;
  range: CellRange;
  operator?: NumberOperator;
  value1?: string;
  value2?: string;
  listItems?: string[];
  listRangeRef?: string;
  errorStyle: ErrorStyle;
  errorTitle?: string;
  errorMessage?: string;
  inputTitle?: string;
  inputMessage?: string;
  allowBlank: boolean;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  errorStyle?: ErrorStyle;
}

export function createRuleId(): string {
  return `dv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cellInRange(row: number, col: number, range: CellRange): boolean {
  return (
    row >= range.startRow && row <= range.endRow &&
    col >= range.startCol && col <= range.endCol
  );
}

export function serializeRule(rule: ValidationRule): string {
  return JSON.stringify(rule);
}

export function deserializeRule(raw: string): ValidationRule | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id || !parsed.type || !parsed.range) return null;
    return parsed as ValidationRule;
  } catch {
    return null;
  }
}
