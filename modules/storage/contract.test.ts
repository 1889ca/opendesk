/** Contract: contracts/storage/rules.md */
import { describe, it, expect } from 'vitest';
import {
  StorageTier,
  StorageTierSchema,
  SnapshotReadResultSchema,
  SaveSnapshotParamsSchema,
  SaveYjsBinaryParamsSchema,
  STATE_VECTOR_PRUNE_THRESHOLD_DAYS,
} from './contract.ts';

describe('StorageTier', () => {
  it('defines hot and cold tiers', () => {
    expect(StorageTier.Hot).toBe('hot');
    expect(StorageTier.Cold).toBe('cold');
  });
});

describe('StorageTierSchema', () => {
  it('accepts valid tiers', () => {
    expect(StorageTierSchema.parse('hot')).toBe('hot');
    expect(StorageTierSchema.parse('cold')).toBe('cold');
  });

  it('rejects invalid tiers', () => {
    expect(() => StorageTierSchema.parse('warm')).toThrow();
    expect(() => StorageTierSchema.parse('')).toThrow();
  });
});

describe('SnapshotReadResultSchema', () => {
  it('accepts a valid snapshot result', () => {
    const input = {
      snapshot: { type: 'doc', content: [] },
      revisionId: 'rev-001',
    };
    const result = SnapshotReadResultSchema.parse(input);
    expect(result.revisionId).toBe('rev-001');
    expect(result.staleSeconds).toBeUndefined();
  });

  it('accepts optional staleSeconds', () => {
    const input = {
      snapshot: { type: 'doc', content: [] },
      revisionId: 'rev-002',
      staleSeconds: 3600,
    };
    const result = SnapshotReadResultSchema.parse(input);
    expect(result.staleSeconds).toBe(3600);
  });

  it('rejects negative staleSeconds', () => {
    const input = {
      snapshot: {},
      revisionId: 'rev-003',
      staleSeconds: -1,
    };
    expect(() => SnapshotReadResultSchema.parse(input)).toThrow();
  });

  it('rejects missing revisionId', () => {
    expect(() => SnapshotReadResultSchema.parse({ snapshot: {} })).toThrow();
  });
});

describe('SaveSnapshotParamsSchema', () => {
  const validParams = {
    docId: 'doc-001',
    snapshot: { type: 'doc', content: [] },
    revisionId: 'rev-001',
    stateVector: new Uint8Array([1, 2, 3]),
  };

  it('accepts valid save params', () => {
    const result = SaveSnapshotParamsSchema.parse(validParams);
    expect(result.docId).toBe('doc-001');
    expect(result.revisionId).toBe('rev-001');
  });

  it('rejects empty docId', () => {
    expect(() =>
      SaveSnapshotParamsSchema.parse({ ...validParams, docId: '' }),
    ).toThrow();
  });

  it('rejects missing stateVector', () => {
    const { stateVector: _, ...noVector } = validParams;
    expect(() => SaveSnapshotParamsSchema.parse(noVector)).toThrow();
  });
});

describe('SaveYjsBinaryParamsSchema', () => {
  it('accepts valid binary params', () => {
    const input = { docId: 'doc-001', binary: Buffer.from([10, 20]) };
    const result = SaveYjsBinaryParamsSchema.parse(input);
    expect(result.docId).toBe('doc-001');
  });

  it('rejects empty docId', () => {
    expect(() =>
      SaveYjsBinaryParamsSchema.parse({
        docId: '',
        binary: Buffer.from([1]),
      }),
    ).toThrow();
  });

  it('rejects missing binary', () => {
    expect(() =>
      SaveYjsBinaryParamsSchema.parse({ docId: 'doc-001' }),
    ).toThrow();
  });
});

describe('STATE_VECTOR_PRUNE_THRESHOLD_DAYS', () => {
  it('is 30 days', () => {
    expect(STATE_VECTOR_PRUNE_THRESHOLD_DAYS).toBe(30);
  });
});
