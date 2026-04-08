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

// Ed25519 signed Yjs updates
export {
  signUpdate,
  verifySignedUpdate,
  storeSignedUpdate,
  loadSignedUpdates,
  verifyDocumentSignatures,
  hashUpdate,
  type SignedUpdate,
  type SignatureVerifyResult,
} from './internal/yjs-signatures.ts';

// Ed25519 key management
export {
  generateSigningKeyPair,
  storePublicKey,
  loadPublicKey,
  loadAllPublicKeys,
  type SigningKeyPair,
  type PublicKeyRecord,
} from './internal/ed25519-keys.ts';

// Signature routes
export { createSignatureRoutes, type SignatureRoutesOptions } from './internal/signature-routes.ts';
