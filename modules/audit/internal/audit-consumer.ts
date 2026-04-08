/** Contract: contracts/audit/rules.md */

import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { EventBusModule, DomainEvent } from '../../events/contract.ts';
import { EventType } from '../../events/contract.ts';
import { computeHash } from './hmac-chain.ts';
import { appendEntry, getLatestForDocument } from './audit-store.ts';
import type { AuditEntry } from '../contract.ts';

export type AuditConsumer = {
  start(): Promise<void>;
};

/**
 * Creates an EventBus consumer that records every domain event
 * as an HMAC-chained audit entry.
 */
export function createAuditConsumer(
  pool: Pool,
  eventBus: EventBusModule,
  hmacSecret: string,
): AuditConsumer {
  async function handleEvent(event: DomainEvent): Promise<void> {
    const documentId = event.aggregateId;
    const latest = await getLatestForDocument(pool, documentId);
    const previousHash = latest?.hash ?? null;

    const hash = computeHash(
      {
        eventId: event.id,
        documentId,
        actorId: event.actorId,
        action: event.type,
        occurredAt: event.occurredAt,
        previousHash,
      },
      hmacSecret,
    );

    const entry: AuditEntry = {
      id: randomUUID(),
      eventId: event.id,
      documentId,
      actorId: event.actorId,
      actorType: event.actorType,
      action: event.type,
      hash,
      previousHash,
      occurredAt: event.occurredAt,
    };

    await appendEntry(pool, entry);
  }

  return {
    async start(): Promise<void> {
      const allEventTypes = Object.values(EventType);
      await eventBus.subscribe('audit', allEventTypes, handleEvent);
    },
  };
}
