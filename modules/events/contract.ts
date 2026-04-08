/** Contract: contracts/events/rules.md */
import { z } from 'zod';

// --- EventType Registry ---

export const EventType = {
  DocumentUpdated: 'DocumentUpdated',
  StateFlushed: 'StateFlushed',
  GrantCreated: 'GrantCreated',
  GrantRevoked: 'GrantRevoked',
  ConversionRequested: 'ConversionRequested',
  ExportReady: 'ExportReady',
  AuditEntryCreated: 'AuditEntryCreated',
  WorkflowTriggered: 'WorkflowTriggered',
  WorkflowCompleted: 'WorkflowCompleted',
  ErasureCompleted: 'ErasureCompleted',
  CascadeErasureCompleted: 'CascadeErasureCompleted',
  RetentionPruneCompleted: 'RetentionPruneCompleted',
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

export const EventTypeSchema = z.enum([
  'DocumentUpdated',
  'StateFlushed',
  'GrantCreated',
  'GrantRevoked',
  'ConversionRequested',
  'ExportReady',
  'AuditEntryCreated',
  'WorkflowTriggered',
  'WorkflowCompleted',
  'ErasureCompleted',
  'CascadeErasureCompleted',
  'RetentionPruneCompleted',
]);

// --- Actor ---

export const ActorTypeSchema = z.enum(['human', 'agent', 'system']);

export type ActorType = z.infer<typeof ActorTypeSchema>;

// --- DomainEvent (thin -- no payloads, no state vectors, no content) ---

const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export const DomainEventSchema = z.object({
  id: z.string().regex(uuidv4Regex, 'Must be a valid UUIDv4'),
  type: EventTypeSchema,
  aggregateId: z.string().min(1),
  revisionId: z.string().optional(),
  actorId: z.string().min(1),
  actorType: ActorTypeSchema,
  occurredAt: z.string().regex(isoDateRegex, 'Must be an ISO 8601 datetime string'),
});

export type DomainEvent = z.infer<typeof DomainEventSchema>;

// --- Outbox Entry ---

export const OutboxEntrySchema = DomainEventSchema.extend({
  publishedAt: z.string().regex(isoDateRegex).nullable(),
});

export type OutboxEntry = z.infer<typeof OutboxEntrySchema>;

// --- Consumer Group Management ---

export const ConsumerGroupSchema = z.object({
  name: z.string().min(1),
  eventTypes: z.array(EventTypeSchema).min(1),
});

export type ConsumerGroup = z.infer<typeof ConsumerGroupSchema>;

export const AcknowledgeRequestSchema = z.object({
  consumerGroup: z.string().min(1),
  eventId: z.string().regex(uuidv4Regex, 'Must be a valid UUIDv4'),
});

export type AcknowledgeRequest = z.infer<typeof AcknowledgeRequestSchema>;

// --- Schema Registry ---

export const EventTypeRegistrationSchema = z.object({
  type: EventTypeSchema,
  ownerModule: z.string().min(1),
});

export type EventTypeRegistration = z.infer<typeof EventTypeRegistrationSchema>;

// --- EventBus Interface ---

/** A PG client within a BEGIN/COMMIT block — callers pass their transaction client. */
export type PgTransaction = {
  query(sql: string, params?: unknown[]): Promise<unknown>;
};

export interface EventBus {
  /** Emit an event. Pass a PG transaction client for transactional outbox, or null for standalone emit. */
  emit(event: DomainEvent, pgTransaction: PgTransaction | null): Promise<void>;
  subscribe(consumerGroup: string, eventTypes: EventType[], handler: EventHandler): Promise<void>;
  acknowledge(consumerGroup: string, eventId: string): Promise<void>;
  registerEventType(type: EventType, ownerModule: string): Promise<void>;
}

// --- Subscriber Callback ---

export type EventHandler = (event: DomainEvent) => Promise<void>;

// --- EventBus Module (with lifecycle) ---

export interface EventBusModule extends EventBus {
  startConsuming(): void;
  stopConsuming(): void;
  startBackgroundJobs(): void;
  stopBackgroundJobs(): void;
}
