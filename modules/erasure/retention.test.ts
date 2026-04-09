/** Contract: contracts/erasure/rules.md */
import { describe, it, expect } from 'vitest';
import {
  RetentionPolicySchema,
  PrunePreviewSchema,
  PruneResultSchema,
} from './contract.ts';

const validAttestation = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  docId: 'doc-123',
  type: 'retention_prune',
  actorId: 'user-1',
  legalBasis: 'Retention policy: Delete old KB drafts (max 90 days)',
  details: 'Pruned kb_draft entry "Old draft" (age: 95 days)',
  hash: 'a'.repeat(64),
  previousHash: null,
  issuedAt: '2026-04-07T12:00:00.000Z',
};

describe('RetentionPolicySchema', () => {
  it('parses a valid policy', () => {
    const result = RetentionPolicySchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Delete old KB drafts',
      target: 'kb_draft',
      maxAgeDays: 90,
      enabled: true,
      createdAt: '2026-04-07T12:00:00.000Z',
      updatedAt: '2026-04-07T12:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-positive maxAgeDays', () => {
    const result = RetentionPolicySchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Bad policy',
      target: 'kb_draft',
      maxAgeDays: 0,
      enabled: true,
      createdAt: '2026-04-07T12:00:00.000Z',
      updatedAt: '2026-04-07T12:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid target', () => {
    const result = RetentionPolicySchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Bad target',
      target: 'invalid_target',
      maxAgeDays: 30,
      enabled: true,
      createdAt: '2026-04-07T12:00:00.000Z',
      updatedAt: '2026-04-07T12:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('PrunePreviewSchema', () => {
  it('parses a valid preview', () => {
    const result = PrunePreviewSchema.safeParse({
      policyId: '550e8400-e29b-41d4-a716-446655440000',
      matchedEntries: [{ id: 'e1', type: 'kb_draft', age: 95 }],
      wouldDelete: 1,
      dryRun: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-dryRun preview', () => {
    const result = PrunePreviewSchema.safeParse({
      policyId: '550e8400-e29b-41d4-a716-446655440000',
      matchedEntries: [],
      wouldDelete: 0,
      dryRun: false,
    });
    expect(result.success).toBe(false);
  });
});

describe('PruneResultSchema', () => {
  it('parses a valid prune result', () => {
    const result = PruneResultSchema.safeParse({
      policyId: '550e8400-e29b-41d4-a716-446655440000',
      deleted: 5,
      attestations: [validAttestation],
      dryRun: false,
    });
    expect(result.success).toBe(true);
  });
});
