/** Contract: contracts/workflow/rules.md */
import type { ConditionOperator } from '../contract.ts';

/**
 * Safely resolve a dot-path field from a context object.
 * e.g. "document.title" resolves ctx.document.title
 */
function resolveField(ctx: Record<string, unknown>, field: string): unknown {
  const parts = field.split('.');
  let current: unknown = ctx;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function toString(val: unknown): string {
  if (val == null) return '';
  return String(val);
}

function toNumber(val: unknown): number {
  return Number(val);
}

/**
 * Evaluate a single condition against a context object.
 * No eval(), no code injection — purely declarative comparison.
 */
export function evaluateCondition(
  field: string,
  operator: ConditionOperator,
  value: string,
  context: Record<string, unknown>,
): boolean {
  const resolved = resolveField(context, field);
  const resolvedStr = toString(resolved);

  switch (operator) {
    case 'equals':
      return resolvedStr === value;
    case 'not_equals':
      return resolvedStr !== value;
    case 'contains':
      return resolvedStr.includes(value);
    case 'not_contains':
      return !resolvedStr.includes(value);
    case 'starts_with':
      return resolvedStr.startsWith(value);
    case 'ends_with':
      return resolvedStr.endsWith(value);
    case 'greater_than':
      return toNumber(resolved) > toNumber(value);
    case 'less_than':
      return toNumber(resolved) < toNumber(value);
    case 'includes': {
      if (Array.isArray(resolved)) {
        return resolved.includes(value);
      }
      return resolvedStr.includes(value);
    }
    case 'not_includes': {
      if (Array.isArray(resolved)) {
        return !resolved.includes(value);
      }
      return !resolvedStr.includes(value);
    }
    default:
      return false;
  }
}
