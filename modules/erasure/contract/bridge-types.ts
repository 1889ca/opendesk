/** Contract: contracts/erasure/rules.md */
import { z } from 'zod';

// Erasure-immutability bridge: ties pre/post-erasure hash states to
// the audit chain so the chain stays verifiable across legally-
// mandated erasures. Includes selective disclosure proofs that let
// auditors verify a single document at a point in time without
// access to the redacted content.

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
