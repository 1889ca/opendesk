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
} from './contract.ts';

// Factory
export { createErasure, type ErasureDependencies } from './internal/create-erasure.ts';

// Routes
export { createErasureRoutes, type ErasureRoutesOptions } from './internal/erasure-routes.ts';
