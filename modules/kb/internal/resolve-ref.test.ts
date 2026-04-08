/** Contract: contracts/kb/rules.md */
import { describe, it, expect } from 'vitest';
import { parseKbUri, buildKbUri } from './resolve-ref.ts';

describe('parseKbUri', () => {
  it('parses a pinned version URI', () => {
    const ref = parseKbUri('kb://a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11@v7');
    expect(ref).toEqual({
      entryId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      version: 7,
    });
  });

  it('parses a latest URI', () => {
    const ref = parseKbUri('kb://a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11@latest');
    expect(ref).toEqual({
      entryId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      version: 'latest',
    });
  });

  it('returns null for invalid URIs', () => {
    expect(parseKbUri('http://example.com')).toBeNull();
    expect(parseKbUri('kb://not-a-uuid@v1')).toBeNull();
    expect(parseKbUri('kb://a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')).toBeNull();
    expect(parseKbUri('')).toBeNull();
  });

  it('parses v1 correctly', () => {
    const ref = parseKbUri('kb://a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11@v1');
    expect(ref?.version).toBe(1);
  });
});

describe('buildKbUri', () => {
  it('builds a pinned version URI', () => {
    const uri = buildKbUri({
      entryId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      version: 3,
    });
    expect(uri).toBe('kb://a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11@v3');
  });

  it('builds a latest URI', () => {
    const uri = buildKbUri({
      entryId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      version: 'latest',
    });
    expect(uri).toBe('kb://a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11@latest');
  });

  it('round-trips with parseKbUri', () => {
    const original = {
      entryId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      version: 42 as const,
    };
    const uri = buildKbUri(original);
    const parsed = parseKbUri(uri);
    expect(parsed).toEqual(original);
  });
});
