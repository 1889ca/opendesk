/** Contract: contracts/workflow/rules.md */
import { describe, it, expect } from 'vitest';
import {
  WorkflowDefinitionSchema,
  CreateWorkflowSchema,
  TriggerTypeSchema,
  ActionTypeSchema,
} from './contract.ts';

describe('WorkflowDefinitionSchema', () => {
  const validDef = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    documentId: 'doc-123',
    name: 'On update webhook',
    triggerType: 'document.updated',
    actionType: 'webhook',
    actionConfig: { url: 'https://example.com/hook' },
    createdBy: 'user-1',
    active: true,
    createdAt: '2026-04-07T12:00:00.000Z',
    updatedAt: '2026-04-07T12:00:00.000Z',
  };

  it('parses a valid definition', () => {
    const result = WorkflowDefinitionSchema.safeParse(validDef);
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID', () => {
    const result = WorkflowDefinitionSchema.safeParse({ ...validDef, id: 'bad' });
    expect(result.success).toBe(false);
  });
});

describe('CreateWorkflowSchema', () => {
  it('parses valid create input', () => {
    const result = CreateWorkflowSchema.safeParse({
      name: 'Test',
      documentId: 'doc-1',
      triggerType: 'grant.created',
      actionType: 'notify',
      actionConfig: { message: 'New grant!' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = CreateWorkflowSchema.safeParse({
      documentId: 'doc-1',
      triggerType: 'grant.created',
      actionType: 'notify',
      actionConfig: { message: 'New grant!' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing actionConfig', () => {
    const result = CreateWorkflowSchema.safeParse({
      name: 'Test',
      documentId: 'doc-1',
      triggerType: 'grant.created',
      actionType: 'notify',
    });
    expect(result.success).toBe(false);
  });
});

describe('TriggerTypeSchema', () => {
  it('accepts valid trigger types', () => {
    for (const type of ['document.updated', 'document.exported', 'grant.created', 'grant.revoked']) {
      expect(TriggerTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it('rejects unknown trigger types', () => {
    expect(TriggerTypeSchema.safeParse('unknown.type').success).toBe(false);
  });
});

describe('ActionTypeSchema', () => {
  it('accepts valid action types', () => {
    for (const type of ['webhook', 'export', 'notify']) {
      expect(ActionTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it('rejects unknown action types', () => {
    expect(ActionTypeSchema.safeParse('email').success).toBe(false);
  });
});
