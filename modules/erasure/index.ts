/** Contract: contracts/erasure/rules.md */

// Schemas & types
export {
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
  type ErasureBridge,
  type ChainVerifyResult,
  type SelectiveDisclosureProof,
  type LegalHold,
  type ErasureConflict,
  type JurisdictionPolicy,
  type ErasureModule,
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
