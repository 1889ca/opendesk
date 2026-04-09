/** Contract: contracts/kb/rules.md — Input schema validation tests */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  CreateEntryInputSchema,
  UpdateEntryInputSchema,
  CreateRelationshipInputSchema,
  KBQueryFilterSchema,
} from './schemas.ts';

describe('CreateEntryInputSchema', () => {
  it('accepts valid input', () => {
    const result = CreateEntryInputSchema.safeParse({
      workspaceId: randomUUID(),
      entryType: 'note',
      title: 'My Note',
      metadata: { body: 'text' },
      tags: ['test'],
      createdBy: 'user-1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing title', () => {
    const result = CreateEntryInputSchema.safeParse({
      workspaceId: randomUUID(),
      entryType: 'note',
      createdBy: 'user-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid workspaceId', () => {
    const result = CreateEntryInputSchema.safeParse({
      workspaceId: 'not-uuid',
      entryType: 'note',
      title: 'Test',
      createdBy: 'user-1',
    });
    expect(result.success).toBe(false);
  });

  it('applies default tags', () => {
    const result = CreateEntryInputSchema.parse({
      workspaceId: randomUUID(),
      entryType: 'reference',
      title: 'Test',
      createdBy: 'user-1',
    });
    expect(result.tags).toEqual([]);
  });
});

describe('UpdateEntryInputSchema', () => {
  it('accepts partial updates', () => {
    const result = UpdateEntryInputSchema.safeParse({
      title: 'New Title',
      updatedBy: 'user-1',
    });
    expect(result.success).toBe(true);
  });

  it('requires updatedBy', () => {
    const result = UpdateEntryInputSchema.safeParse({ title: 'New Title' });
    expect(result.success).toBe(false);
  });
});

describe('CreateRelationshipInputSchema', () => {
  it('accepts valid input', () => {
    const result = CreateRelationshipInputSchema.safeParse({
      workspaceId: randomUUID(),
      sourceId: randomUUID(),
      targetId: randomUUID(),
      relationType: 'cites',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty relationType', () => {
    const result = CreateRelationshipInputSchema.safeParse({
      workspaceId: randomUUID(),
      sourceId: randomUUID(),
      targetId: randomUUID(),
      relationType: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts custom relation types', () => {
    const result = CreateRelationshipInputSchema.safeParse({
      workspaceId: randomUUID(),
      sourceId: randomUUID(),
      targetId: randomUUID(),
      relationType: 'my-custom-relation',
    });
    expect(result.success).toBe(true);
  });
});

describe('KBQueryFilterSchema', () => {
  it('applies defaults', () => {
    const result = KBQueryFilterSchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it('rejects limit over 200', () => {
    expect(KBQueryFilterSchema.safeParse({ limit: 300 }).success).toBe(false);
  });

  it('accepts valid filter', () => {
    const result = KBQueryFilterSchema.safeParse({
      entryType: 'entity',
      tags: ['physics'],
      limit: 25,
      offset: 10,
    });
    expect(result.success).toBe(true);
  });
});
