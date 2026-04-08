/** Contract: contracts/kb/rules.md */
import { describe, it, expect } from 'vitest';
import {
  EntitySubtypeSchema,
  KBEntitySchema,
  EntityCreateInputSchema,
  EntityUpdateInputSchema,
  PersonContentSchema,
  OrganizationContentSchema,
  ProjectContentSchema,
  TermContentSchema,
  ENTITY_SUBTYPES,
  contentSchemaForSubtype,
} from './contract.ts';

describe('EntitySubtypeSchema', () => {
  it('accepts valid subtypes', () => {
    for (const subtype of ENTITY_SUBTYPES) {
      expect(EntitySubtypeSchema.parse(subtype)).toBe(subtype);
    }
  });

  it('rejects invalid subtypes', () => {
    expect(() => EntitySubtypeSchema.parse('invalid')).toThrow();
    expect(() => EntitySubtypeSchema.parse('')).toThrow();
  });
});

describe('KBEntitySchema', () => {
  it('parses a valid entity', () => {
    const entity = KBEntitySchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      workspaceId: '550e8400-e29b-41d4-a716-446655440001',
      subtype: 'person',
      name: 'Alice Smith',
      content: { role: 'Engineer' },
      tags: ['staff'],
      createdBy: 'user-1',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    });
    expect(entity.name).toBe('Alice Smith');
    expect(entity.subtype).toBe('person');
  });

  it('rejects empty name', () => {
    expect(() =>
      KBEntitySchema.parse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        workspaceId: '550e8400-e29b-41d4-a716-446655440001',
        subtype: 'person',
        name: '',
        content: {},
        tags: [],
        createdBy: 'user-1',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }),
    ).toThrow();
  });

  it('rejects name over 200 characters', () => {
    expect(() =>
      KBEntitySchema.parse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        workspaceId: '550e8400-e29b-41d4-a716-446655440001',
        subtype: 'person',
        name: 'x'.repeat(201),
        content: {},
        tags: [],
        createdBy: 'user-1',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }),
    ).toThrow();
  });
});

describe('EntityCreateInputSchema', () => {
  it('parses minimal create input', () => {
    const input = EntityCreateInputSchema.parse({
      name: 'Test Entity',
      subtype: 'organization',
    });
    expect(input.name).toBe('Test Entity');
    expect(input.content).toEqual({});
    expect(input.tags).toEqual([]);
  });

  it('parses full create input', () => {
    const input = EntityCreateInputSchema.parse({
      name: 'ACME Corp',
      subtype: 'organization',
      content: { orgType: 'company', website: 'https://acme.com' },
      tags: ['partner'],
    });
    expect(input.tags).toEqual(['partner']);
  });
});

describe('EntityUpdateInputSchema', () => {
  it('parses partial update', () => {
    const input = EntityUpdateInputSchema.parse({ name: 'Updated Name' });
    expect(input.name).toBe('Updated Name');
    expect(input.subtype).toBeUndefined();
  });

  it('allows empty update', () => {
    const input = EntityUpdateInputSchema.parse({});
    expect(input).toEqual({});
  });
});

describe('content schemas', () => {
  it('validates person content', () => {
    const content = PersonContentSchema.parse({
      role: 'Engineer',
      email: 'alice@example.com',
      bio: 'Builds things.',
    });
    expect(content.role).toBe('Engineer');
  });

  it('rejects invalid person email', () => {
    expect(() =>
      PersonContentSchema.parse({ email: 'not-an-email' }),
    ).toThrow();
  });

  it('validates organization content', () => {
    const content = OrganizationContentSchema.parse({
      orgType: 'company',
      website: 'https://example.com',
    });
    expect(content.orgType).toBe('company');
  });

  it('rejects invalid org type', () => {
    expect(() =>
      OrganizationContentSchema.parse({ orgType: 'startup' }),
    ).toThrow();
  });

  it('validates project content', () => {
    const content = ProjectContentSchema.parse({
      status: 'active',
      description: 'A cool project',
    });
    expect(content.status).toBe('active');
  });

  it('validates term content', () => {
    const content = TermContentSchema.parse({
      definition: 'A thing that does stuff',
      domain: 'engineering',
      relatedTerms: ['widget', 'gadget'],
    });
    expect(content.relatedTerms).toHaveLength(2);
  });

  it('contentSchemaForSubtype returns correct schema', () => {
    expect(contentSchemaForSubtype('person')).toBe(PersonContentSchema);
    expect(contentSchemaForSubtype('organization')).toBe(OrganizationContentSchema);
    expect(contentSchemaForSubtype('project')).toBe(ProjectContentSchema);
    expect(contentSchemaForSubtype('term')).toBe(TermContentSchema);
  });
});
