/** Contract: contracts/erasure/rules.md */
import { z } from 'zod';

const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hexRegex = /^[0-9a-f]{64}$/i;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

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
