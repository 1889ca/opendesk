/** Contract: contracts/erasure/rules.md */

// Public contract for the erasure module. Type definitions are
// split across modules/erasure/contract/ to stay under the 200-line
// hard limit (issue #136); this file re-exports them and declares
// the ErasureModule interface that the implementation honors.

export {
  ErasureAttestationSchema,
  type ErasureAttestation,
  RetentionPolicySchema,
  type RetentionPolicy,
  RetentionScanResultSchema,
  type RetentionScanResult,
  ErasureRequestSchema,
  type ErasureRequest,
  ErasureTypeEnum,
  type ErasureType,
  TombstoneEntrySchema,
  type TombstoneEntry,
  TombstoneReportSchema,
  type TombstoneReport,
  RedactionResultSchema,
  type RedactionResult,
  CascadeResultSchema,
  type CascadeResult,
  type AnonymizationResult,
  PrunePreviewSchema,
  type PrunePreview,
  PruneResultSchema,
  type PruneResult,
} from './contract/erasure-types.ts';

export {
  LegalBasis,
  LegalBasisSchema,
  Jurisdiction,
  JurisdictionSchema,
  ChainStatus,
  ErasureBridgeSchema,
  type ErasureBridge,
  ChainVerifyResultSchema,
  type ChainVerifyResult,
  SelectiveDisclosureProofSchema,
  type SelectiveDisclosureProof,
} from './contract/bridge-types.ts';

export {
  HoldType,
  LegalHoldSchema,
  type LegalHold,
  ConflictType,
  ErasureConflictSchema,
  type ErasureConflict,
  JurisdictionPolicySchema,
  type JurisdictionPolicy,
} from './contract/hold-types.ts';

import type {
  ErasureAttestation,
  RetentionPolicy,
  RetentionScanResult,
  PrunePreview,
  PruneResult,
} from './contract/erasure-types.ts';
import type {
  ErasureBridge,
  ChainVerifyResult,
  SelectiveDisclosureProof,
  LegalBasis,
  Jurisdiction,
} from './contract/bridge-types.ts';
import type {
  HoldType,
  LegalHold,
  ErasureConflict,
  JurisdictionPolicy,
} from './contract/hold-types.ts';

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
