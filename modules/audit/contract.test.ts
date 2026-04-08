/** Contract: contracts/audit/rules.md */
import { describe, it, expect } from 'vitest';
import { AuditEntrySchema, AuditLogQuerySchema, AuditVerifyResultSchema } from './contract.ts';

const validEntry = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  eventId: '660e8400-e29b-41d4-a716-446655440001',
  documentId: 'doc-123',
  actorId: 'user-1',
  actorType: 'human',
  action: 'DocumentUpdated',
  hash: 'a'.repeat(64),
  previousHash: null,
  occurredAt: '2026-04-07T12:00:00.000Z',
};

describe('AuditEntrySchema', () => {
  it('parses a valid entry', () => {
    const result = AuditEntrySchema.safeParse(validEntry);
    expect(result.success).toBe(true);
  });

  it('accepts entry with previousHash', () => {
    const result = AuditEntrySchema.safeParse({
      ...validEntry,
      previousHash: 'b'.repeat(64),
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID for id', () => {
    const result = AuditEntrySchema.safeParse({
      ...validEntry,
      id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID for eventId', () => {
    const result = AuditEntrySchema.safeParse({
      ...validEntry,
      eventId: 'bad',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const { documentId, ...incomplete } = validEntry;
    const result = AuditEntrySchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it('rejects invalid actorType', () => {
    const result = AuditEntrySchema.safeParse({
      ...validEntry,
      actorType: 'robot',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid hash format', () => {
    const result = AuditEntrySchema.safeParse({
      ...validEntry,
      hash: 'too-short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid occurredAt format', () => {
    const result = AuditEntrySchema.safeParse({
      ...validEntry,
      occurredAt: 'April 7, 2026',
    });
    expect(result.success).toBe(false);
  });
});

describe('AuditLogQuerySchema', () => {
  it('parses with only documentId', () => {
    const result = AuditLogQuerySchema.safeParse({ documentId: 'doc-123' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.cursor).toBeUndefined();
    }
  });

  it('accepts valid cursor and limit', () => {
    const result = AuditLogQuerySchema.safeParse({
      documentId: 'doc-123',
      cursor: '550e8400-e29b-41d4-a716-446655440000',
      limit: 100,
    });
    expect(result.success).toBe(true);
  });

  it('rejects limit over 200', () => {
    const result = AuditLogQuerySchema.safeParse({
      documentId: 'doc-123',
      limit: 201,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty documentId', () => {
    const result = AuditLogQuerySchema.safeParse({ documentId: '' });
    expect(result.success).toBe(false);
  });
});

describe('AuditVerifyResultSchema', () => {
  it('parses verified result', () => {
    const result = AuditVerifyResultSchema.safeParse({
      documentId: 'doc-123',
      totalEntries: 10,
      verified: true,
      brokenAtId: null,
    });
    expect(result.success).toBe(true);
  });

  it('parses broken chain result', () => {
    const result = AuditVerifyResultSchema.safeParse({
      documentId: 'doc-123',
      totalEntries: 5,
      verified: false,
      brokenAtId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });
});
