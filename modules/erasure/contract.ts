/** Contract: contracts/erasure/rules.md */
import { z } from 'zod';

// --- Erasure Attestation ---

export const ErasureAttestationSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string(),
  actorId: z.string(),
  actorType: z.enum(['human', 'agent', 'system']),
  reason: z.string().min(1),
  preStateHash: z.string(),
  postStateHash: z.string(),
  stateChanged: z.boolean(),
  yjsSizeBefore: z.number().int().nonnegative(),
  yjsSizeAfter: z.number().int().nonnegative(),
  createdAt: z.string(),
});

export type ErasureAttestation = z.infer<typeof ErasureAttestationSchema>;

// --- Retention Policy ---

export const RetentionPolicySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  documentType: z.string().default('*'),
  maxAgeDays: z.number().int().positive(),
  autoPurge: z.boolean().default(false),
  createdBy: z.string(),
  createdAt: z.string(),
});

export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;

// --- Retention Scan Result ---

export const RetentionScanResultSchema = z.object({
  policy: RetentionPolicySchema,
  matchedDocuments: z.array(z.object({
    documentId: z.string(),
    title: z.string(),
    documentType: z.string(),
    updatedAt: z.string(),
    ageDays: z.number(),
  })),
});

export type RetentionScanResult = z.infer<typeof RetentionScanResultSchema>;

// --- Erasure Request ---

export const ErasureRequestSchema = z.object({
  documentId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

export type ErasureRequest = z.infer<typeof ErasureRequestSchema>;

// --- Module Interface ---

export interface ErasureModule {
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
}
