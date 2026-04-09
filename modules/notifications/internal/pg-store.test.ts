/** Contract: contracts/notifications/rules.md */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  NotificationTypeSchema,
  CreateNotificationSchema,
  NotificationSchema,
} from '../contract.ts';

/**
 * Tests for the notification contract schemas and type validation.
 * The pg-store itself requires a real Pool, so we test the schema
 * validation that guards its inputs and outputs.
 */

describe('NotificationTypeSchema', () => {
  it('accepts valid notification types', () => {
    const types = ['comment_added', 'document_shared', 'workflow_triggered', 'kb_updated'];
    for (const t of types) {
      expect(NotificationTypeSchema.parse(t)).toBe(t);
    }
  });

  it('rejects invalid notification types', () => {
    expect(() => NotificationTypeSchema.parse('invalid_type')).toThrow();
    expect(() => NotificationTypeSchema.parse('')).toThrow();
    expect(() => NotificationTypeSchema.parse(42)).toThrow();
  });
});

describe('CreateNotificationSchema', () => {
  it('validates a complete create payload', () => {
    const input = {
      user_id: 'user-123',
      type: 'document_shared',
      payload: { eventId: 'evt-1', aggregateId: 'doc-1' },
    };
    const result = CreateNotificationSchema.parse(input);
    expect(result.user_id).toBe('user-123');
    expect(result.type).toBe('document_shared');
    expect(result.payload).toEqual({ eventId: 'evt-1', aggregateId: 'doc-1' });
  });

  it('defaults payload to empty object when omitted', () => {
    const result = CreateNotificationSchema.parse({
      user_id: 'user-123',
      type: 'comment_added',
    });
    expect(result.payload).toEqual({});
  });

  it('rejects empty user_id', () => {
    expect(() =>
      CreateNotificationSchema.parse({ user_id: '', type: 'comment_added' }),
    ).toThrow();
  });

  it('rejects missing type', () => {
    expect(() =>
      CreateNotificationSchema.parse({ user_id: 'user-1' }),
    ).toThrow();
  });
});

describe('NotificationSchema', () => {
  it('validates a complete notification record', () => {
    const record = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: 'user-123',
      type: 'workflow_triggered',
      payload: { workflowId: 'wf-1' },
      read: false,
      created_at: '2026-01-01T00:00:00Z',
    };
    const result = NotificationSchema.parse(record);
    expect(result.id).toBe(record.id);
    expect(result.read).toBe(false);
  });

  it('rejects non-UUID id', () => {
    expect(() =>
      NotificationSchema.parse({
        id: 'not-a-uuid',
        user_id: 'user-1',
        type: 'comment_added',
        payload: {},
        read: false,
        created_at: '2026-01-01T00:00:00Z',
      }),
    ).toThrow();
  });
});
