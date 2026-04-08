/** Contract: contracts/erasure/rules.md */

// Schemas & types
export {
  TombstoneEntrySchema,
  TombstoneReportSchema,
  AnonymizationResultSchema,
  ErasureTypeSchema,
  ErasureAttestationSchema,
  RedactionResultSchema,
  CascadeResultSchema,
  RetentionPolicySchema,
  PrunePreviewSchema,
  PruneResultSchema,
  type TombstoneEntry,
  type TombstoneReport,
  type AnonymizationResult,
  type ErasureType,
  type ErasureAttestation,
  type RedactionResult,
  type CascadeResult,
  type RetentionPolicy,
  type PrunePreview,
  type PruneResult,
  type ErasureModule,
} from './contract.ts';

// Factory
export { createErasure, type ErasureDependencies } from './internal/create-erasure.ts';

// Routes
export { createErasureRoutes, type ErasureRoutesOptions } from './internal/erasure-routes.ts';

// Scheduler
export { createPruneScheduler, type SchedulerConfig } from './internal/prune-scheduler.ts';

// Attestation utilities (for testing / external verification)
export { computeAttestationHash } from './internal/attestation.ts';

// Tombstone scanner (standalone utility)
export { extractTombstones } from './internal/tombstone-scanner.ts';

// Anonymizer (standalone utility)
export { anonymizeDocument } from './internal/anonymizer.ts';
