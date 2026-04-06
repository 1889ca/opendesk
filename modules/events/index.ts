/** Contract: contracts/events/rules.md */
export {
  // Enums and constants
  EventType,

  // Schemas
  EventTypeSchema,
  ActorTypeSchema,
  DomainEventSchema,
  OutboxEntrySchema,
  ConsumerGroupSchema,
  AcknowledgeRequestSchema,
  EventTypeRegistrationSchema,

  // Types
  type ActorType,
  type DomainEvent,
  type OutboxEntry,
  type ConsumerGroup,
  type AcknowledgeRequest,
  type EventTypeRegistration,
  type PgTransaction,
  type EventBus,
  type EventHandler,
} from './contract.js';
