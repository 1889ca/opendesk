/** Contract: contracts/erasure/rules.md */

// Schemas & types
export {
  ErasureAttestationSchema,
  RetentionPolicySchema,
  RetentionScanResultSchema,
  ErasureRequestSchema,
  ErasureTypeEnum,
  TombstoneEntrySchema,
  TombstoneReportSchema,
  RedactionResultSchema,
  CascadeResultSchema,
  PrunePreviewSchema,
  PruneResultSchema,
  ErasureBridgeSchema,
  ChainVerifyResultSchema,
  SelectiveDisclosureProofSchema,
  LegalHoldSchema,
  ErasureConflictSchema,
  JurisdictionPolicySchema,
  LegalBasisSchema,
  JurisdictionSchema,
  LegalBasis,
  Jurisdiction,
  ChainStatus,
  HoldType,
  ConflictType,
  type ErasureAttestation,
  type RetentionPolicy,
  type RetentionScanResult,
  type ErasureRequest,
  type ErasureModule,
  type ErasureType,
  type TombstoneEntry,
  type TombstoneReport,
  type RedactionResult,
  type CascadeResult,
  type AnonymizationResult,
  type PrunePreview,
  type PruneResult,
  type ErasureBridge,
  type ChainVerifyResult,
  type SelectiveDisclosureProof,
  type LegalHold,
  type ErasureConflict,
  type JurisdictionPolicy,
} from './contract.ts';

// Factory
export { createErasure, type ErasureDependencies } from './internal/create-erasure.ts';

// Routes
export { createErasureRoutes, type ErasureRoutesOptions } from './internal/erasure-routes.ts';

// Hash utilities (for testing / external verification)
export {
  computeBridgeHash,
  verifyBridgeHash,
  computeProofHash,
  verifyProofHash,
} from './internal/bridge-hash.ts';
