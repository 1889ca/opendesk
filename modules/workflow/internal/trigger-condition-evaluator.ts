/** Contract: contracts/workflow/rules.md */
import type {
  TriggerCondition,
  LeafTriggerCondition,
  DocumentVersionFilter,
  KBEntityChangeFilter,
  FormSubmissionFilter,
} from './config-schemas.ts';
import { evaluateCondition } from './condition-evaluator.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('workflow:trigger-conditions');

/**
 * Context produced by the event handler — the fetched state of the entity
 * that changed, keyed by trigger type for safety.
 */
export type TriggerEvalContext =
  | { type: 'document_version'; versionNumber: number; versionName: string | null }
  | { type: 'kb_entity_change'; entity: Record<string, unknown> }
  | { type: 'form_submission'; answers: Record<string, unknown> };

/** Evaluate a DocumentVersion leaf condition against a version snapshot context. */
function evalDocumentVersion(
  filter: DocumentVersionFilter,
  ctx: Extract<TriggerEvalContext, { type: 'document_version' }>,
): boolean {
  if (filter.versionNumber !== undefined && ctx.versionNumber !== filter.versionNumber) {
    return false;
  }
  // Named version match is case-insensitive to reduce human error
  if (filter.versionName !== undefined) {
    if (!ctx.versionName) return false;
    if (ctx.versionName.toLowerCase() !== filter.versionName.toLowerCase()) return false;
  }
  return true;
}

/** Evaluate a KBEntityChange leaf condition against a flat entity context. */
function evalKBEntityChange(
  filter: KBEntityChangeFilter,
  ctx: Extract<TriggerEvalContext, { type: 'kb_entity_change' }>,
): boolean {
  return evaluateCondition(filter.field, filter.operator, filter.value, ctx.entity);
}

/** Evaluate a FormSubmission leaf condition against the answers map. */
function evalFormSubmission(
  filter: FormSubmissionFilter,
  ctx: Extract<TriggerEvalContext, { type: 'form_submission' }>,
): boolean {
  return evaluateCondition(filter.field, filter.operator, filter.value, ctx.answers);
}

/** Evaluate a leaf trigger condition against its typed context. */
function evalLeaf(leaf: LeafTriggerCondition, ctx: TriggerEvalContext): boolean {
  if (leaf.type !== ctx.type) {
    // Type mismatch — the condition is not applicable to this event context.
    // Returning false prevents accidental cross-type fires.
    log.warn('trigger condition type mismatch', { conditionType: leaf.type, contextType: ctx.type });
    return false;
  }

  switch (leaf.type) {
    case 'document_version':
      return evalDocumentVersion(
        leaf.filter as DocumentVersionFilter,
        ctx as Extract<TriggerEvalContext, { type: 'document_version' }>,
      );
    case 'kb_entity_change':
      return evalKBEntityChange(
        leaf.filter as KBEntityChangeFilter,
        ctx as Extract<TriggerEvalContext, { type: 'kb_entity_change' }>,
      );
    case 'form_submission':
      return evalFormSubmission(
        leaf.filter as FormSubmissionFilter,
        ctx as Extract<TriggerEvalContext, { type: 'form_submission' }>,
      );
    default:
      return false;
  }
}

/**
 * Recursively evaluate a trigger condition tree (leaf or compound AND/OR).
 * Pure function — no side effects, no I/O.
 */
export function evalTriggerCondition(condition: TriggerCondition, ctx: TriggerEvalContext): boolean {
  if ('operator' in condition) {
    // Compound condition
    const { operator, conditions } = condition;
    if (conditions.length === 0) return false;

    if (operator === 'AND') {
      return conditions.every((c) => evalTriggerCondition(c, ctx));
    }
    // OR
    return conditions.some((c) => evalTriggerCondition(c, ctx));
  }

  // Leaf condition
  return evalLeaf(condition, ctx);
}
