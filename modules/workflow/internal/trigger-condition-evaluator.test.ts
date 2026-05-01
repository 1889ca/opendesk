/** Contract: contracts/workflow/rules.md */
import { describe, it, expect } from 'vitest';
import { evalTriggerCondition, type TriggerEvalContext } from './trigger-condition-evaluator.ts';
import type { TriggerCondition } from './config-schemas.ts';

// --- document_version contexts ---

const versionCtx: TriggerEvalContext = {
  type: 'document_version',
  versionNumber: 5,
  versionName: 'Final Draft',
};

// --- kb_entity_change contexts ---

const kbCtx: TriggerEvalContext = {
  type: 'kb_entity_change',
  entity: { status: 'published', name: 'Q4 Report', score: 95 },
};

// --- form_submission contexts ---

const formCtx: TriggerEvalContext = {
  type: 'form_submission',
  answers: { score: '85', sentiment: 'positive', region: 'EMEA' },
};

describe('evalTriggerCondition — document_version', () => {
  it('matches exact version number', () => {
    const cond: TriggerCondition = {
      type: 'document_version',
      filter: { versionNumber: 5 },
    };
    expect(evalTriggerCondition(cond, versionCtx)).toBe(true);
  });

  it('rejects wrong version number', () => {
    const cond: TriggerCondition = {
      type: 'document_version',
      filter: { versionNumber: 3 },
    };
    expect(evalTriggerCondition(cond, versionCtx)).toBe(false);
  });

  it('matches exact version name (case-insensitive)', () => {
    const cond: TriggerCondition = {
      type: 'document_version',
      filter: { versionName: 'final draft' },
    };
    expect(evalTriggerCondition(cond, versionCtx)).toBe(true);
  });

  it('rejects wrong version name', () => {
    const cond: TriggerCondition = {
      type: 'document_version',
      filter: { versionName: 'Alpha' },
    };
    expect(evalTriggerCondition(cond, versionCtx)).toBe(false);
  });

  it('matches when both versionNumber and versionName match', () => {
    const cond: TriggerCondition = {
      type: 'document_version',
      filter: { versionNumber: 5, versionName: 'Final Draft' },
    };
    expect(evalTriggerCondition(cond, versionCtx)).toBe(true);
  });

  it('rejects when versionNumber matches but versionName does not', () => {
    const cond: TriggerCondition = {
      type: 'document_version',
      filter: { versionNumber: 5, versionName: 'Beta' },
    };
    expect(evalTriggerCondition(cond, versionCtx)).toBe(false);
  });

  it('rejects when context has no versionName but filter requires one', () => {
    const ctx: TriggerEvalContext = { type: 'document_version', versionNumber: 5, versionName: null };
    const cond: TriggerCondition = {
      type: 'document_version',
      filter: { versionName: 'Final' },
    };
    expect(evalTriggerCondition(cond, ctx)).toBe(false);
  });
});

describe('evalTriggerCondition — kb_entity_change', () => {
  it('matches status equals published', () => {
    const cond: TriggerCondition = {
      type: 'kb_entity_change',
      filter: { field: 'status', operator: 'equals', value: 'published' },
    };
    expect(evalTriggerCondition(cond, kbCtx)).toBe(true);
  });

  it('rejects when status does not match', () => {
    const cond: TriggerCondition = {
      type: 'kb_entity_change',
      filter: { field: 'status', operator: 'equals', value: 'draft' },
    };
    expect(evalTriggerCondition(cond, kbCtx)).toBe(false);
  });

  it('supports greater_than numeric comparison', () => {
    const cond: TriggerCondition = {
      type: 'kb_entity_change',
      filter: { field: 'score', operator: 'greater_than', value: '80' },
    };
    expect(evalTriggerCondition(cond, kbCtx)).toBe(true);
  });

  it('rejects when condition type mismatches context', () => {
    const cond: TriggerCondition = {
      type: 'kb_entity_change',
      filter: { field: 'status', operator: 'equals', value: 'published' },
    };
    // Evaluating a kb condition against a form context — must return false
    expect(evalTriggerCondition(cond, formCtx)).toBe(false);
  });
});

describe('evalTriggerCondition — form_submission', () => {
  it('matches score greater_than 80', () => {
    const cond: TriggerCondition = {
      type: 'form_submission',
      filter: { field: 'score', operator: 'greater_than', value: '80' },
    };
    expect(evalTriggerCondition(cond, formCtx)).toBe(true);
  });

  it('rejects score less_than 80', () => {
    const cond: TriggerCondition = {
      type: 'form_submission',
      filter: { field: 'score', operator: 'less_than', value: '80' },
    };
    expect(evalTriggerCondition(cond, formCtx)).toBe(false);
  });

  it('matches sentiment equals positive', () => {
    const cond: TriggerCondition = {
      type: 'form_submission',
      filter: { field: 'sentiment', operator: 'equals', value: 'positive' },
    };
    expect(evalTriggerCondition(cond, formCtx)).toBe(true);
  });
});

describe('evalTriggerCondition — compound AND', () => {
  it('AND returns true when all conditions pass', () => {
    const cond: TriggerCondition = {
      operator: 'AND',
      conditions: [
        { type: 'kb_entity_change', filter: { field: 'status', operator: 'equals', value: 'published' } },
        { type: 'kb_entity_change', filter: { field: 'score', operator: 'greater_than', value: '80' } },
      ],
    };
    expect(evalTriggerCondition(cond, kbCtx)).toBe(true);
  });

  it('AND returns false when any condition fails', () => {
    const cond: TriggerCondition = {
      operator: 'AND',
      conditions: [
        { type: 'kb_entity_change', filter: { field: 'status', operator: 'equals', value: 'published' } },
        { type: 'kb_entity_change', filter: { field: 'score', operator: 'less_than', value: '50' } },
      ],
    };
    expect(evalTriggerCondition(cond, kbCtx)).toBe(false);
  });
});

describe('evalTriggerCondition — compound OR', () => {
  it('OR returns true when at least one condition passes', () => {
    const cond: TriggerCondition = {
      operator: 'OR',
      conditions: [
        { type: 'kb_entity_change', filter: { field: 'status', operator: 'equals', value: 'draft' } },
        { type: 'kb_entity_change', filter: { field: 'status', operator: 'equals', value: 'published' } },
      ],
    };
    expect(evalTriggerCondition(cond, kbCtx)).toBe(true);
  });

  it('OR returns false when all conditions fail', () => {
    const cond: TriggerCondition = {
      operator: 'OR',
      conditions: [
        { type: 'kb_entity_change', filter: { field: 'status', operator: 'equals', value: 'draft' } },
        { type: 'kb_entity_change', filter: { field: 'status', operator: 'equals', value: 'deprecated' } },
      ],
    };
    expect(evalTriggerCondition(cond, kbCtx)).toBe(false);
  });
});

// Nested compound and empty-array edge-case tests live in
// trigger-condition-evaluator-compound.test.ts (max-lines split).
