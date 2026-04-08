/** Contract: contracts/audit/rules.md */
import { z } from 'zod';

// --- Regex patterns ---

const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hexRegex = /^[0-9a-f]{64}$/i;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// --- AuditEntry ---

export const AuditEntrySchema = z.object({
  id: z.string().regex(uuidv4Regex, 'Must be a valid UUIDv4'),
  eventId: z.string().regex(uuidv4Regex, 'Must be a valid UUIDv4'),
  documentId: z.string().min(1),
  actorId: z.string().min(1),
  actorType: z.enum(['human', 'agent', 'system']),
  action: z.string().min(1),
  hash: z.string().regex(hexRegex, 'Must be a 64-char hex string'),
  previousHash: z.string().regex(hexRegex).nullable(),
  occurredAt: z.string().regex(isoDateRegex, 'Must be an ISO 8601 datetime string'),
});

export type AuditEntry = z.infer<typeof AuditEntrySchema>;

// --- Log Query ---

export const AuditLogQuerySchema = z.object({
  documentId: z.string().min(1),
  cursor: z.string().regex(uuidv4Regex).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;

// --- Verify Result ---

export const AuditVerifyResultSchema = z.object({
  documentId: z.string().min(1),
  totalEntries: z.number().int().nonnegative(),
  verified: z.boolean(),
  brokenAtId: z.string().regex(uuidv4Regex).nullable(),
});

export type AuditVerifyResult = z.infer<typeof AuditVerifyResultSchema>;

// --- Module Interface ---

export interface AuditModule {
  /** Record a domain event as an HMAC-chained audit entry. */
  recordEvent(event: import('../events/contract.ts').DomainEvent): Promise<void>;
  /** Query paginated audit log for a document. */
  getLog(documentId: string, cursor?: string, limit?: number): Promise<AuditEntry[]>;
  /** Verify the HMAC chain for a document. */
  verifyChain(documentId: string): Promise<AuditVerifyResult>;
}
