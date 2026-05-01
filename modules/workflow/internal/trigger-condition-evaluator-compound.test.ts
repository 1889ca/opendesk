/** Contract: contracts/workflow/rules.md */
import { describe, it, expect } from 'vitest';
import { evalTriggerCondition, type TriggerEvalContext } from './trigger-condition-evaluator.ts';
import type { TriggerCondition } from './config-schemas.ts';

const kbCtx: TriggerEvalContext = {
  type: 'kb_entity_change',
  entity: { status: 'published', name: 'Q4 Report', score: 95 },
};

describe('evalTriggerCondition — nested compound', () => {
  it('(A AND B) OR C — fires when C passes even if A AND B fails', () => {
    const cond: TriggerCondition = {
      operator: 'OR',
      conditions: [
        {
          operator: 'AND',
          conditions: [
            { type: 'kb_entity_change', filter: { field: 'status', operator: 'equals', value: 'draft' } },
            { type: 'kb_entity_change', filter: { field: 'score', operator: 'greater_than', value: '80' } },
          ],
        },
        { type: 'kb_entity_change', filter: { field: 'name', operator: 'contains', value: 'Q4' } },
      ],
    };
    expect(evalTriggerCondition(cond, kbCtx)).toBe(true);
  });

  it('(A AND B) OR C — does not fire when all fail', () => {
    const cond: TriggerCondition = {
      operator: 'OR',
      conditions: [
        {
          operator: 'AND',
          conditions: [
            { type: 'kb_entity_change', filter: { field: 'status', operator: 'equals', value: 'draft' } },
            { type: 'kb_entity_change', filter: { field: 'score', operator: 'greater_than', value: '80' } },
          ],
        },
        { type: 'kb_entity_change', filter: { field: 'name', operator: 'contains', value: 'Q1' } },
      ],
    };
    expect(evalTriggerCondition(cond, kbCtx)).toBe(false);
  });
});

describe('evalTriggerCondition — compound with empty conditions array', () => {
  it('empty AND returns false', () => {
    const cond: TriggerCondition = { operator: 'AND', conditions: [] };
    expect(evalTriggerCondition(cond, kbCtx)).toBe(false);
  });

  it('empty OR returns false', () => {
    const cond: TriggerCondition = { operator: 'OR', conditions: [] };
    expect(evalTriggerCondition(cond, kbCtx)).toBe(false);
  });
});
