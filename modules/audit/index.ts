/** Contract: contracts/audit/rules.md */

// Schemas & types
export {
  AuditEntrySchema,
  AuditLogQuerySchema,
  AuditVerifyResultSchema,
  type AuditEntry,
  type AuditLogQuery,
  type AuditVerifyResult,
  type AuditModule,
} from './contract.ts';

// Factory
export { createAudit, type AuditDependencies } from './internal/create-audit.ts';

// Routes
export { createAuditRoutes, type AuditRoutesOptions } from './internal/audit-routes.ts';

// HMAC utilities (for testing / external verification)
export { computeHash, verifyHash } from './internal/hmac-chain.ts';

// Pillar 2 M2: Point-in-time verifiability
export {
  exportAuditProof,
  exportAuditProofSummary,
  verifyAuditProof,
  type AuditProof,
  type AuditProofSummary,
} from './internal/proof-export.ts';
