/** Contract: contracts/ai/rules.md */

import { EventType, type EventBusModule, type DomainEvent } from '../../events/contract.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('ai-embeddings');

export type EmbeddingConsumer = {
  start(): Promise<void>;
  stop(): void;
};

/**
 * Creates an EventBus consumer that auto-embeds documents
 * whenever a StateFlushed event fires.
 */
export function createEmbeddingConsumer(
  eventBus: EventBusModule,
  embedDocument: (documentId: string) => Promise<number>,
): EmbeddingConsumer {
  let running = false;

  async function handleEvent(event: DomainEvent): Promise<void> {
    const documentId = event.aggregateId;
    log.info('embedding triggered', { documentId, eventId: event.id });

    try {
      const count = await embedDocument(documentId);
      log.info('embedding complete', { documentId, chunks: count });
    } catch (err) {
      log.error('embedding failed', {
        documentId,
        eventId: event.id,
        error: String(err),
      });
    }
  }

  return {
    async start(): Promise<void> {
      if (running) return;
      running = true;
      await eventBus.subscribe(
        'ai-embeddings',
        [EventType.StateFlushed],
        handleEvent,
      );
      log.info('consumer started');
    },

    stop(): void {
      running = false;
      log.info('consumer stopped');
    },
  };
}
