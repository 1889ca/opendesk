/** Contract: contracts/events/rules.md */
import { describe, it, expect } from 'vitest';
import { DomainEventSchema, EventTypeSchema, OutboxEntrySchema } from './contract.ts';

describe('DomainEventSchema', () => {
  const validEvent = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    type: 'DocumentUpdated',
    aggregateId: 'doc-123',
    actorId: 'user-1',
    actorType: 'human',
    occurredAt: '2026-04-07T12:00:00.000Z',
  };

  it('parses a valid event', () => {
    const result = DomainEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it('accepts optional revisionId', () => {
    const result = DomainEventSchema.safeParse({
      ...validEvent,
      revisionId: 'rev-abc',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID', () => {
    const result = DomainEventSchema.safeParse({
      ...validEvent,
      id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid actor type', () => {
    const result = DomainEventSchema.safeParse({
      ...validEvent,
      actorType: 'robot',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid occurredAt format', () => {
    const result = DomainEventSchema.safeParse({
      ...validEvent,
      occurredAt: 'April 7, 2026',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty aggregateId', () => {
    const result = DomainEventSchema.safeParse({
      ...validEvent,
      aggregateId: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('EventTypeSchema', () => {
  it('accepts all registered event types', () => {
    const types = [
      'DocumentUpdated', 'StateFlushed', 'GrantCreated', 'GrantRevoked',
      'ConversionRequested', 'ExportReady',
      'AuditEntryCreated', 'WorkflowTriggered', 'WorkflowCompleted',
    ];
    for (const type of types) {
      expect(EventTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it('rejects unknown event types', () => {
    expect(EventTypeSchema.safeParse('UnknownEvent').success).toBe(false);
  });
});

describe('OutboxEntrySchema', () => {
  it('accepts entry with null publishedAt', () => {
    const result = OutboxEntrySchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'DocumentUpdated',
      aggregateId: 'doc-123',
      actorId: 'user-1',
      actorType: 'human',
      occurredAt: '2026-04-07T12:00:00.000Z',
      publishedAt: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts entry with valid publishedAt', () => {
    const result = OutboxEntrySchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'DocumentUpdated',
      aggregateId: 'doc-123',
      actorId: 'user-1',
      actorType: 'human',
      occurredAt: '2026-04-07T12:00:00.000Z',
      publishedAt: '2026-04-07T12:00:01.000Z',
    });
    expect(result.success).toBe(true);
  });
});
