/** Contract: contracts/app-entities/rules.md */
import { describe, it, expect } from 'vitest';
import type {
  EntityCreatePayload,
  EntityUpdatePayload,
} from './entity-api.ts';

/**
 * Tests for the entity API type contracts and payload construction.
 * The actual API functions depend on apiFetch (browser-only),
 * so we validate the data shapes and URL construction logic.
 */

describe('EntityCreatePayload shape', () => {
  it('accepts a valid create payload', () => {
    const payload: EntityCreatePayload = {
      name: 'Test Entity',
      subtype: 'person',
      content: { role: 'Engineer', email: 'test@example.com' },
      tags: ['team', 'engineering'],
    };
    expect(payload.name).toBe('Test Entity');
    expect(payload.subtype).toBe('person');
    expect(payload.content.role).toBe('Engineer');
    expect(payload.tags).toHaveLength(2);
  });

  it('allows empty content object', () => {
    const payload: EntityCreatePayload = {
      name: 'Empty',
      subtype: 'term',
      content: {},
      tags: [],
    };
    expect(Object.keys(payload.content)).toHaveLength(0);
  });
});

describe('EntityUpdatePayload shape', () => {
  it('allows partial updates', () => {
    const payload: EntityUpdatePayload = { name: 'Updated Name' };
    expect(payload.name).toBe('Updated Name');
    expect(payload.subtype).toBeUndefined();
    expect(payload.content).toBeUndefined();
    expect(payload.tags).toBeUndefined();
  });

  it('allows updating just tags', () => {
    const payload: EntityUpdatePayload = { tags: ['new-tag'] };
    expect(payload.tags).toEqual(['new-tag']);
  });
});

describe('URL construction logic', () => {
  const BASE = '/api/kb/entities';

  function buildEntityUrl(subtype?: string, query?: string): string {
    const params = new URLSearchParams();
    if (subtype) params.set('subtype', subtype);
    if (query) params.set('q', query);
    const url = params.toString() ? `${BASE}?${params}` : BASE;
    return url;
  }

  it('builds base URL with no params', () => {
    expect(buildEntityUrl()).toBe('/api/kb/entities');
  });

  it('builds URL with subtype filter', () => {
    const url = buildEntityUrl('person');
    expect(url).toBe('/api/kb/entities?subtype=person');
  });

  it('builds URL with search query', () => {
    const url = buildEntityUrl(undefined, 'alice');
    expect(url).toBe('/api/kb/entities?q=alice');
  });

  it('builds URL with both params', () => {
    const url = buildEntityUrl('organization', 'acme');
    expect(url).toContain('subtype=organization');
    expect(url).toContain('q=acme');
  });

  it('encodes special characters in entity ID for detail URL', () => {
    const id = 'entity/with spaces';
    const url = `${BASE}/${encodeURIComponent(id)}`;
    expect(url).toBe('/api/kb/entities/entity%2Fwith%20spaces');
  });
});
