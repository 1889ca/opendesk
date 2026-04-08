/** Contract: contracts/audit/rules.md */

import type { Pool } from 'pg';
import type { EventBusModule, DomainEvent } from '../../events/contract.ts';
import type { AuditModule, AuditEntry, AuditVerifyResult } from '../contract.ts';
import { computeHash, verifyHash } from './hmac-chain.ts';
import * as store from './audit-store.ts';
import { createAuditConsumer } from './audit-consumer.ts';
import { randomUUID } from 'node:crypto';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('audit');

export type AuditDependencies = {
  pool: Pool;
  eventBus: EventBusModule;
  hmacSecret: string;
};

/**
 * Factory: creates the audit module and starts the EventBus consumer.
 */
export function createAudit(deps: AuditDependencies): AuditModule {
  const { pool, eventBus, hmacSecret } = deps;
  const consumer = createAuditConsumer(pool, eventBus, hmacSecret);

  // Start consuming events (fire-and-forget; errors logged internally)
  consumer.start().catch((err) => {
    log.error('failed to start consumer', { error: String(err) });
  });

  return {
    async recordEvent(event: DomainEvent): Promise<void> {
      const documentId = event.aggregateId;
      const latest = await store.getLatestForDocument(pool, documentId);
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

      await store.appendEntry(pool, entry);
    },

    async getLog(
      documentId: string,
      cursor?: string,
      limit?: number,
    ): Promise<AuditEntry[]> {
      return store.getLog(pool, documentId, cursor, limit);
    },

    async verifyChain(documentId: string): Promise<AuditVerifyResult> {
      const chain = await store.getFullChain(pool, documentId);

      if (chain.length === 0) {
        return { documentId, totalEntries: 0, verified: true, brokenAtId: null };
      }

      for (let i = 0; i < chain.length; i++) {
        const entry = chain[i];
        const expectedPrev = i === 0 ? null : chain[i - 1].hash;

        if (entry.previousHash !== expectedPrev) {
          return {
            documentId,
            totalEntries: chain.length,
            verified: false,
            brokenAtId: entry.id,
          };
        }

        if (!verifyHash(entry, hmacSecret)) {
          return {
            documentId,
            totalEntries: chain.length,
            verified: false,
            brokenAtId: entry.id,
          };
        }
      }

      return { documentId, totalEntries: chain.length, verified: true, brokenAtId: null };
    },
  };
}
