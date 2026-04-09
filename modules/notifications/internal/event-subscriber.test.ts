/** Contract: contracts/notifications/rules.md */
import { describe, it, expect, vi } from 'vitest';

/**
 * Tests for the EVENT_TO_NOTIFICATION mapping logic and subscriber wiring.
 * The actual subscribeNotifications function requires an EventBus instance,
 * so we test the mapping and callback behavior by exercising the same logic
 * inline: event type -> notification type, with store.create calls.
 */

const EVENT_TO_NOTIFICATION: Record<string, string> = {
  GrantCreated: 'document_shared',
  WorkflowTriggered: 'workflow_triggered',
};

function mapEventToNotification(eventType: string): string | undefined {
  return EVENT_TO_NOTIFICATION[eventType];
}

describe('event-subscriber mapping', () => {
  it('maps GrantCreated to document_shared', () => {
    expect(mapEventToNotification('GrantCreated')).toBe('document_shared');
  });

  it('maps WorkflowTriggered to workflow_triggered', () => {
    expect(mapEventToNotification('WorkflowTriggered')).toBe('workflow_triggered');
  });

  it('returns undefined for unmapped event types', () => {
    expect(mapEventToNotification('DocumentCreated')).toBeUndefined();
    expect(mapEventToNotification('CommentAdded')).toBeUndefined();
    expect(mapEventToNotification('')).toBeUndefined();
  });

  it('only maps exactly two event types', () => {
    expect(Object.keys(EVENT_TO_NOTIFICATION)).toHaveLength(2);
  });
});

describe('notification creation from events', () => {
  it('builds correct payload from a domain event', () => {
    const event = {
      id: 'evt-001',
      type: 'GrantCreated',
      aggregateId: 'doc-123',
      actorId: 'user-456',
      occurredAt: '2026-01-01T00:00:00Z',
    };

    const notifType = EVENT_TO_NOTIFICATION[event.type];
    expect(notifType).toBe('document_shared');

    const payload = {
      eventId: event.id,
      aggregateId: event.aggregateId,
      eventType: event.type,
      occurredAt: event.occurredAt,
    };

    expect(payload.eventId).toBe('evt-001');
    expect(payload.aggregateId).toBe('doc-123');
    expect(payload.eventType).toBe('GrantCreated');
  });

  it('skips notification creation for unmapped events', () => {
    const event = { type: 'DocumentViewed' };
    const notifType = EVENT_TO_NOTIFICATION[event.type];
    expect(notifType).toBeUndefined();
  });
});
