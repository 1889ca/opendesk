/** Contract: contracts/erasure/rules.md */
import { z } from 'zod';

const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hexRegex = /^[0-9a-f]{64}$/i;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// --- Tombstone Entry ---

export const TombstoneEntrySchema = z.object({
  /** Yjs item ID (clock-based). */
  itemId: z.string(),
  /** Content that was deleted. */
  content: z.string(),
  /** Timestamp of deletion (if available from Yjs metadata). */
  deletedAt: z.string().nullable(),
  /** User who deleted this content (if signed updates exist). */
  deletedBy: z.string().nullable(),
  /** CRDT type: 'text', 'array', 'map', 'xml'. */
  crdtType: z.enum(['text', 'array', 'map', 'xml']),
});

export type TombstoneEntry = z.infer<typeof TombstoneEntrySchema>;

// --- Tombstone Report ---

export const TombstoneReportSchema = z.object({
  docId: z.string().min(1),
  tombstones: z.array(TombstoneEntrySchema),
  extractedAt: z.string().regex(isoDateRegex),
});

export type TombstoneReport = z.infer<typeof TombstoneReportSchema>;

// --- Anonymization Result ---

export const AnonymizationResultSchema = z.object({
  docId: z.string().min(1),
  targetUserId: z.string().min(1),
  itemsAnonymized: z.number().int().nonnegative(),
  /** New Yjs document state with zero-filled tombstones. */
  newState: z.instanceof(Uint8Array),
});

export type AnonymizationResult = z.infer<typeof AnonymizationResultSchema>;

// --- Erasure Attestation ---

export const ErasureTypeSchema = z.enum([
  'tombstone_purge',
  'anonymization',
  'redaction',
  'cascade_erasure',
  'retention_prune',
]);

export type ErasureType = z.infer<typeof ErasureTypeSchema>;

export const ErasureAttestationSchema = z.object({
  id: z.string().regex(uuidv4Regex),
  docId: z.string().min(1),
  type: ErasureTypeSchema,
  actorId: z.string().min(1),
  legalBasis: z.string().min(1),
  details: z.string(),
  hash: z.string().regex(hexRegex),
  previousHash: z.string().regex(hexRegex).nullable(),
  issuedAt: z.string().regex(isoDateRegex),
});

export type ErasureAttestation = z.infer<typeof ErasureAttestationSchema>;

// --- Redaction Result ---

export const RedactionResultSchema = z.object({
  docId: z.string().min(1),
  redactedCount: z.number().int().nonnegative(),
  attestation: ErasureAttestationSchema,
});

export type RedactionResult = z.infer<typeof RedactionResultSchema>;

// --- Cascade Result ---

export const CascadeResultSchema = z.object({
  sourceEntryId: z.string().min(1),
  affectedDocuments: z.array(z.string()),
  notificationsSent: z.number().int().nonnegative(),
  attestation: ErasureAttestationSchema,
});

export type CascadeResult = z.infer<typeof CascadeResultSchema>;

// --- Retention Policy ---

export const RetentionPolicySchema = z.object({
  id: z.string().regex(uuidv4Regex),
  name: z.string().min(1),
  /** Target: what kind of content this policy applies to. */
  target: z.enum(['kb_draft', 'kb_published', 'document_draft', 'tombstone']),
  /** Maximum age in days before content is eligible for pruning. */
  maxAgeDays: z.number().int().positive(),
  /** Whether this policy is active. */
  enabled: z.boolean().default(true),
  createdAt: z.string().regex(isoDateRegex),
  updatedAt: z.string().regex(isoDateRegex),
});

export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;

// --- Prune Preview ---

export const PrunePreviewSchema = z.object({
  policyId: z.string().regex(uuidv4Regex),
  matchedEntries: z.array(z.object({
    id: z.string(),
    type: z.string(),
    age: z.number(),
    title: z.string().optional(),
  })),
  wouldDelete: z.number().int().nonnegative(),
  dryRun: z.literal(true),
});

export type PrunePreview = z.infer<typeof PrunePreviewSchema>;

// --- Prune Result ---

export const PruneResultSchema = z.object({
  policyId: z.string().regex(uuidv4Regex),
  deleted: z.number().int().nonnegative(),
  attestations: z.array(ErasureAttestationSchema),
  dryRun: z.literal(false),
});

export type PruneResult = z.infer<typeof PruneResultSchema>;

// --- Module Interface ---

export interface ErasureModule {
  /** Scan a Yjs document and extract all tombstoned content. */
  extractTombstones(docId: string, crdtState: Uint8Array): Promise<TombstoneReport>;

  /** Zero-fill Yjs tombstone payloads for a target user, preserving CRDT structure. */
  anonymizeDocument(docId: string, targetUserId: string, legalBasis: string, requestedBy: string): Promise<AnonymizationResult>;

  /** Redact content matching a pattern or user ID from a document. */
  redactContent(docId: string, opts: { userId?: string; pattern?: string; legalBasis: string; requestedBy: string }): Promise<RedactionResult>;

  /** Erase a KB entry and cascade to all referencing documents. */
  cascadeEraseKbEntry(entryId: string, legalBasis: string, requestedBy: string): Promise<CascadeResult>;

  /** Preview what a retention policy would prune (dry-run). */
  previewPrune(policyId: string): Promise<PrunePreview>;

  /** Execute a retention policy prune. */
  executePrune(policyId: string, requestedBy: string): Promise<PruneResult>;

  /** Create or update a retention policy. */
  upsertPolicy(policy: RetentionPolicy): Promise<RetentionPolicy>;

  /** List all retention policies. */
  listPolicies(): Promise<RetentionPolicy[]>;

  /** Generate an erasure attestation. */
  createAttestation(docId: string, type: ErasureType, actorId: string, legalBasis: string, details: string): Promise<ErasureAttestation>;
}
