/** Contract: contracts/collab/rules.md */
import { z } from 'zod';
import type { DocumentIntent, DocumentSnapshot, RevisionId } from '../document/contract.ts';
import type { DomainEvent } from '../events/contract.ts';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

// --- IntentConflict ---

export const IntentConflictSchema = z.object({
  code: z.literal('STALE_REVISION'),
  baseRevision: z.string(),
  currentRevision: z.string(),
  currentStateVector: z.instanceof(Uint8Array),
});

export type IntentConflict = z.infer<typeof IntentConflictSchema>;

// --- DuplicateIntent ---

export const DuplicateIntentSchema = z.object({
  code: z.literal('DUPLICATE_INTENT'),
  originalRevisionId: z.string(),
});

export type DuplicateIntent = z.infer<typeof DuplicateIntentSchema>;

// --- IntentResult ---

export const IntentSuccessSchema = z.object({
  revisionId: z.string(),
  appliedOperations: z.number().int().nonnegative(),
});

export type IntentSuccess = z.infer<typeof IntentSuccessSchema>;

export type IntentResult = IntentSuccess | IntentConflict | DuplicateIntent;

// --- IntentExecutor ---

export interface IntentExecutor {
  applyIntent(intent: DocumentIntent): Promise<IntentResult>;
}

// --- MaterializerConfig ---

export const MaterializerConfigSchema = z.object({
  /** Milliseconds of inactivity before materialization triggers. */
  debounceIntervalMs: z.number().int().positive(),
  /** Number of operations before materialization triggers regardless of debounce. */
  operationThreshold: z.number().int().positive(),
});

export type MaterializerConfig = z.infer<typeof MaterializerConfigSchema>;

// --- CollabConfig ---

export const CollabConfigSchema = z.object({
  hocuspocus: z.object({
    /** Port is NOT used -- collab exposes an upgrade handler, not its own listener. */
    name: z.string().min(1).optional(),
    quiet: z.boolean().optional(),
  }),
  materializer: MaterializerConfigSchema,
  /** Byte threshold for triggering CRDT compaction in a worker thread. */
  compactionThresholdBytes: z.number().int().positive(),
  /** TTL in milliseconds for idempotency key cache (default: 24 hours). */
  idempotencyTtlMs: z.number().int().positive().default(86_400_000),
});

export type CollabConfig = z.infer<typeof CollabConfigSchema>;

// --- UpgradeHandler ---

export type UpgradeHandler = (
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
) => void;

// --- CollabServer ---

export interface CollabServer {
  start(config: CollabConfig): Promise<void>;
  stop(): Promise<void>;
  getUpgradeHandler(): UpgradeHandler;
}

// --- Event subscriptions (GrantRevoked) ---

export type GrantRevokedHandler = (event: DomainEvent) => Promise<void>;
