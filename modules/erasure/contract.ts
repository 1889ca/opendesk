/** Contract: contracts/erasure/rules.md */
import { z } from 'zod';

const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hexRegex = /^[0-9a-f]{64}$/i;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

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

// --- Legal Basis ---

export const LegalBasis = {
  GDPR_ART_17: 'GDPR_ART_17',
  PIPEDA_PRINCIPLE_9: 'PIPEDA_PRINCIPLE_9',
  HIPAA_RETENTION: 'HIPAA_RETENTION',
  COURT_ORDER: 'COURT_ORDER',
  INTERNAL_POLICY: 'INTERNAL_POLICY',
} as const;

export type LegalBasis = (typeof LegalBasis)[keyof typeof LegalBasis];

export const LegalBasisSchema = z.enum([
  'GDPR_ART_17',
  'PIPEDA_PRINCIPLE_9',
  'HIPAA_RETENTION',
  'COURT_ORDER',
  'INTERNAL_POLICY',
]);

// --- Jurisdiction ---

export const Jurisdiction = {
  EU: 'EU',
  CA: 'CA',
  US_HIPAA: 'US_HIPAA',
} as const;

export type Jurisdiction = (typeof Jurisdiction)[keyof typeof Jurisdiction];

export const JurisdictionSchema = z.enum(['EU', 'CA', 'US_HIPAA']);

// --- Chain Verification Status ---

export const ChainStatus = {
  VALID: 'VALID',
  VALID_WITH_ERASURES: 'VALID_WITH_ERASURES',
  TAMPERED: 'TAMPERED',
} as const;

export type ChainStatus = (typeof ChainStatus)[keyof typeof ChainStatus];

// --- Erasure Bridge ---

export const ErasureBridgeSchema = z.object({
  id: z.string().regex(uuidv4Regex),
  documentId: z.string().min(1),
  attestationId: z.string().min(1),
  preErasureHash: z.string().regex(hexRegex),
  postErasureHash: z.string().regex(hexRegex),
  legalBasis: LegalBasisSchema,
  jurisdiction: JurisdictionSchema.nullable(),
  actorId: z.string().min(1),
  bridgeHash: z.string().regex(hexRegex),
  createdAt: z.string().regex(isoDateRegex),
});

export type ErasureBridge = z.infer<typeof ErasureBridgeSchema>;

// --- Chain Verify Result ---

export const ChainVerifyResultSchema = z.object({
  documentId: z.string().min(1),
  totalEntries: z.number().int().nonnegative(),
  status: z.enum(['VALID', 'VALID_WITH_ERASURES', 'TAMPERED']),
  erasureBridgeCount: z.number().int().nonnegative(),
  brokenAtId: z.string().regex(uuidv4Regex).nullable(),
});

export type ChainVerifyResult = z.infer<typeof ChainVerifyResultSchema>;

// --- Selective Disclosure Proof ---

export const SelectiveDisclosureProofSchema = z.object({
  documentId: z.string().min(1),
  timestamp: z.string().regex(isoDateRegex),
  hashAtPoint: z.string().regex(hexRegex),
  entryId: z.string().regex(uuidv4Regex),
  chainPosition: z.number().int().nonnegative(),
  totalChainLength: z.number().int().positive(),
  erasureBridges: z.array(ErasureBridgeSchema),
  proofHash: z.string().regex(hexRegex),
});

export type SelectiveDisclosureProof = z.infer<typeof SelectiveDisclosureProofSchema>;

// --- Legal Hold ---

export const HoldType = {
  litigation: 'litigation',
  regulatory: 'regulatory',
  ediscovery: 'ediscovery',
} as const;

export type HoldType = (typeof HoldType)[keyof typeof HoldType];

export const LegalHoldSchema = z.object({
  id: z.string().regex(uuidv4Regex),
  documentId: z.string().min(1),
  holdType: z.enum(['litigation', 'regulatory', 'ediscovery']),
  authority: z.string().min(1),
  reason: z.string().nullable(),
  actorId: z.string().min(1),
  startedAt: z.string().regex(isoDateRegex),
  expiresAt: z.string().regex(isoDateRegex).nullable(),
  releasedAt: z.string().regex(isoDateRegex).nullable(),
  releasedBy: z.string().nullable(),
});

export type LegalHold = z.infer<typeof LegalHoldSchema>;

// --- Erasure Conflict ---

export const ConflictType = {
  LEGAL_HOLD: 'LEGAL_HOLD',
  ACTIVE_EDISCOVERY: 'ACTIVE_EDISCOVERY',
  REGULATORY_FILING: 'REGULATORY_FILING',
} as const;

export type ConflictType = (typeof ConflictType)[keyof typeof ConflictType];

export const ErasureConflictSchema = z.object({
  type: z.enum(['LEGAL_HOLD', 'ACTIVE_EDISCOVERY', 'REGULATORY_FILING']),
  holdId: z.string().regex(uuidv4Regex),
  authority: z.string().min(1),
  blocking: z.boolean(),
  message: z.string(),
});

export type ErasureConflict = z.infer<typeof ErasureConflictSchema>;

// --- Jurisdiction Policy ---

export const JurisdictionPolicySchema = z.object({
  jurisdiction: JurisdictionSchema,
  legalBasis: LegalBasisSchema,
  erasureDeadlineDays: z.number().int().positive(),
  description: z.string(),
});

export type JurisdictionPolicy = z.infer<typeof JurisdictionPolicySchema>;

// --- Module Interface ---

export interface ErasureModule {
  // --- Basic erasure operations ---
  /** Erase a document's CRDT history, producing an attestation. */
  eraseDocument(documentId: string, actorId: string, actorType: 'human' | 'agent' | 'system', reason: string): Promise<ErasureAttestation>;
  /** Get all attestations for a document. */
  getAttestations(documentId: string): Promise<ErasureAttestation[]>;
  /** Create a retention policy. */
  createPolicy(policy: Omit<RetentionPolicy, 'id' | 'createdAt'>): Promise<RetentionPolicy>;
  /** List all retention policies. */
  listPolicies(): Promise<RetentionPolicy[]>;
  /** Delete a retention policy. */
  deletePolicy(policyId: string): Promise<boolean>;
  /** Scan for documents matching retention policies (dry run). */
  scanRetention(): Promise<RetentionScanResult[]>;
  /** Execute retention: purge all documents matching active auto-purge policies. */
  executeRetention(actorId: string): Promise<ErasureAttestation[]>;
  /** Preview what a retention policy would prune (dry run). */
  previewPrune(policyId: string): Promise<PrunePreview>;
  /** Execute a retention policy prune. */
  executePrune(policyId: string, actorId: string): Promise<PruneResult>;

  // --- Erasure-immutability bridge operations ---
  /** Create an erasure bridge linking pre/post erasure hash states. */
  createBridge(params: {
    documentId: string;
    attestationId: string;
    preErasureHash: string;
    postErasureHash: string;
    legalBasis: LegalBasis;
    jurisdiction?: Jurisdiction | null;
    actorId: string;
  }): Promise<ErasureBridge>;
  /** Verify chain integrity with erasure-bridge awareness. */
  verifyChain(documentId: string): Promise<ChainVerifyResult>;
  /** Generate a selective disclosure proof for a document at a point in time. */
  generateProof(documentId: string, entryId: string): Promise<SelectiveDisclosureProof>;
  /** Verify a selective disclosure proof independently. */
  verifyProof(proof: SelectiveDisclosureProof): boolean;
  /** Check for conflicts before executing an erasure. */
  checkConflicts(documentId: string): Promise<ErasureConflict[]>;
  /** Create a legal hold on a document. */
  createHold(params: {
    documentId: string;
    holdType: HoldType;
    authority: string;
    reason?: string;
    actorId: string;
    expiresAt?: string;
  }): Promise<LegalHold>;
  /** Release a legal hold. */
  releaseHold(holdId: string, releasedBy: string): Promise<LegalHold>;
  /** Get active holds for a document. */
  getActiveHolds(documentId: string): Promise<LegalHold[]>;
  /** Get the jurisdiction erasure policy for given params. */
  getPolicy(jurisdiction: Jurisdiction, legalBasis: LegalBasis): JurisdictionPolicy;
}
