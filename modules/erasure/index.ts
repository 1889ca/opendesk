/** Contract: contracts/erasure/rules.md */

// Schemas & types
export {
  ErasureAttestationSchema,
  RetentionPolicySchema,
  RetentionScanResultSchema,
  ErasureRequestSchema,
  type ErasureAttestation,
  type RetentionPolicy,
  type RetentionScanResult,
  type ErasureRequest,
  type ErasureModule,
} from './contract.ts';

// Factory
export { createErasure, type ErasureDependencies } from './internal/create-erasure.ts';

// Routes
export { createErasureRoutes, type ErasureRoutesOptions } from './internal/erasure-routes.ts';
