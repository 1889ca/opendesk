/** Contract: contracts/observability/rules.md */

import { describe, it, expect } from 'vitest';
import { formatEvents } from './siem-formatter.ts';
import type { ForensicsEvent } from '../contract.ts';

const sampleEvent: ForensicsEvent = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  eventType: 'DocumentUpdated',
  contentType: 'document',
  actorId: 'user-42',
  actorType: 'human',
  action: 'edit',
  resourceId: 'doc-123',
  occurredAt: '2026-04-08T12:00:00Z',
  metadata: { version: 3 },
};

const deleteEvent: ForensicsEvent = {
  ...sampleEvent,
  id: '660e8400-e29b-41d4-a716-446655440001',
  action: 'delete',
  eventType: 'DocumentDeleted',
};

describe('formatEvents — CEF', () => {
  it('produces valid CEF lines', () => {
    const output = formatEvents([sampleEvent], 'cef');
    expect(output).toContain('CEF:0|OpenDesk|Observability|1.0|');
    expect(output).toContain('DocumentUpdated');
    expect(output).toContain('src=user-42');
    expect(output).toContain('dst=doc-123');
    expect(output).toContain('cs1=document');
  });

  it('assigns higher severity to delete actions', () => {
    const editOutput = formatEvents([sampleEvent], 'cef');
    const deleteOutput = formatEvents([deleteEvent], 'cef');
    // Delete severity (8) > edit severity (3)
    expect(deleteOutput).toContain('|delete|8|');
    expect(editOutput).toContain('|edit|3|');
  });

  it('handles multiple events', () => {
    const output = formatEvents([sampleEvent, deleteEvent], 'cef');
    const lines = output.split('\n');
    expect(lines).toHaveLength(2);
  });
});

describe('formatEvents — syslog RFC 5424', () => {
  it('produces valid syslog lines', () => {
    const output = formatEvents([sampleEvent], 'syslog');
    // RFC 5424: <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME ...
    expect(output).toMatch(/^<\d+>1 /);
    expect(output).toContain('opendesk');
    expect(output).toContain('observability');
    expect(output).toContain('DocumentUpdated');
    expect(output).toContain('contentType="document"');
  });

  it('uses higher priority for delete actions', () => {
    const editOutput = formatEvents([sampleEvent], 'syslog');
    const deleteOutput = formatEvents([deleteEvent], 'syslog');
    // Edit = facility(16)*8 + severity(6) = 134
    // Delete = facility(16)*8 + severity(3) = 131
    expect(editOutput).toContain('<134>');
    expect(deleteOutput).toContain('<131>');
  });
});

describe('formatEvents — JSON lines', () => {
  it('produces valid JSON per line', () => {
    const output = formatEvents([sampleEvent, deleteEvent], 'jsonlines');
    const lines = output.split('\n');
    expect(lines).toHaveLength(2);

    const parsed = JSON.parse(lines[0]);
    expect(parsed.timestamp).toBe('2026-04-08T12:00:00Z');
    expect(parsed.event_type).toBe('DocumentUpdated');
    expect(parsed.content_type).toBe('document');
    expect(parsed.actor_id).toBe('user-42');
    expect(parsed.resource_id).toBe('doc-123');
  });

  it('includes metadata', () => {
    const output = formatEvents([sampleEvent], 'jsonlines');
    const parsed = JSON.parse(output);
    expect(parsed.metadata).toEqual({ version: 3 });
  });
});

describe('formatEvents — empty input', () => {
  it('returns empty string for no events', () => {
    expect(formatEvents([], 'cef')).toBe('');
    expect(formatEvents([], 'syslog')).toBe('');
    expect(formatEvents([], 'jsonlines')).toBe('');
  });
});
