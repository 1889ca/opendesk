/** Contract: contracts/erasure/rules.md */
import { z } from 'zod';

// Core erasure types — attestations, retention policies, scan/preview/
// prune results, and the per-document erasure operations (redaction,
// cascade, anonymization, tombstones).
//
// Bridge / hold / jurisdiction-policy types live in sibling files
// alongside this one.

// --- Erasure Attestation ---

export const ErasureAttestationSchema = z.object({
  id: z.string().uuid(),
  docId: z.string(),
  type: z.enum(['redaction', 'cascade_erasure', 'retention_prune', 'anonymization']),
  actorId: z.string(),
  legalBasis: z.string().min(1),
  details: z.string(),
  hash: z.string().length(64),
  previousHash: z.string().length(64).nullable(),
  issuedAt: z.string(),
});

export type ErasureAttestation = z.infer<typeof ErasureAttestationSchema>;

// --- Retention Policy ---

export const RetentionPolicySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  target: z.enum(['kb_draft', 'kb_published', 'document_draft', 'tombstone']),
  maxAgeDays: z.number().int().positive(),
  enabled: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;

// --- Retention Scan Result ---

export const RetentionScanResultSchema = z.object({
  policy: RetentionPolicySchema,
  matchedDocuments: z.array(z.object({
    documentId: z.string(),
    title: z.string(),
    documentType: z.string(),
    updatedAt: z.string(),
    ageDays: z.number(),
  })),
});

export type RetentionScanResult = z.infer<typeof RetentionScanResultSchema>;

// --- Erasure Request ---

export const ErasureRequestSchema = z.object({
  documentId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

export type ErasureRequest = z.infer<typeof ErasureRequestSchema>;

// --- Erasure Type ---

export const ErasureTypeEnum = z.enum(['redaction', 'cascade_erasure', 'retention_prune', 'anonymization']);
export type ErasureType = z.infer<typeof ErasureTypeEnum>;

// --- Tombstone Entry ---

export const TombstoneEntrySchema = z.object({
  itemId: z.string(),
  content: z.string(),
  deletedAt: z.string().nullable(),
  deletedBy: z.string().nullable(),
  crdtType: z.enum(['text', 'array', 'map', 'xml']),
});

export type TombstoneEntry = z.infer<typeof TombstoneEntrySchema>;

// --- Tombstone Report ---

export const TombstoneReportSchema = z.object({
  docId: z.string(),
  tombstones: z.array(TombstoneEntrySchema),
  extractedAt: z.string().datetime(),
});

export type TombstoneReport = z.infer<typeof TombstoneReportSchema>;

// --- Redaction Result ---

export const RedactionResultSchema = z.object({
  docId: z.string(),
  redactedCount: z.number().int().nonnegative(),
  attestation: ErasureAttestationSchema,
});

export type RedactionResult = z.infer<typeof RedactionResultSchema>;

// --- Cascade Result ---

export const CascadeResultSchema = z.object({
  sourceEntryId: z.string(),
  affectedDocuments: z.array(z.string()),
  notificationsSent: z.number().int().nonnegative(),
  attestation: ErasureAttestationSchema,
});

export type CascadeResult = z.infer<typeof CascadeResultSchema>;

// --- Anonymization Result ---

export interface AnonymizationResult {
  docId: string;
  targetUserId: string;
  itemsAnonymized: number;
  newState: Uint8Array;
}

// --- Prune Preview ---

export const PrunePreviewSchema = z.object({
  policyId: z.string().uuid(),
  matchedEntries: z.array(z.object({
    id: z.string(),
    type: z.string(),
    age: z.number(),
  })),
  wouldDelete: z.number().int().nonnegative(),
  dryRun: z.literal(true),
});

export type PrunePreview = z.infer<typeof PrunePreviewSchema>;

// --- Prune Result ---

export const PruneResultSchema = z.object({
  policyId: z.string().uuid(),
  deleted: z.number().int().nonnegative(),
  attestations: z.array(ErasureAttestationSchema),
  dryRun: z.literal(false),
});

export type PruneResult = z.infer<typeof PruneResultSchema>;
