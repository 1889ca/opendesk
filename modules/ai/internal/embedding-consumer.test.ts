/** Contract: contracts/ai/rules.md */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmbeddingConsumer } from './embedding-consumer.ts';
import { EventType, type EventBusModule, type DomainEvent, type EventHandler } from '../../events/contract.ts';

/** In-memory event bus that stores subscriptions and lets tests dispatch events. */
function createInMemoryEventBus() {
  const subscriptions: { group: string; types: string[]; handler: EventHandler }[] = [];

  const bus: EventBusModule = {
    async emit() { /* no-op for consumer tests */ },
    async subscribe(group: string, types: string[], handler: EventHandler) {
      subscriptions.push({ group, types: types as string[], handler });
    },
    async acknowledge() { /* no-op */ },
    async registerEventType() { /* no-op */ },
    startConsuming() { /* no-op */ },
    stopConsuming() { /* no-op */ },
    startBackgroundJobs() { /* no-op */ },
    stopBackgroundJobs() { /* no-op */ },
  };

  return { bus, subscriptions };
}

function createTestEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    id: 'evt-001',
    type: EventType.StateFlushed,
    aggregateId: 'doc-123',
    actorId: 'user-1',
    actorType: 'human',
    occurredAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('createEmbeddingConsumer', () => {
  let eventBus: ReturnType<typeof createInMemoryEventBus>;
  let embedDocument: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    eventBus = createInMemoryEventBus();
    embedDocument = vi.fn().mockResolvedValue(5);
  });

  it('subscribes to StateFlushed with ai-embeddings consumer group', async () => {
    const consumer = createEmbeddingConsumer(eventBus.bus, embedDocument);
    await consumer.start();

    expect(eventBus.subscriptions).toHaveLength(1);
    expect(eventBus.subscriptions[0].group).toBe('ai-embeddings');
    expect(eventBus.subscriptions[0].types).toEqual([EventType.StateFlushed]);
  });

  it('calls embedDocument with the document ID from the event', async () => {
    const consumer = createEmbeddingConsumer(eventBus.bus, embedDocument);
    await consumer.start();

    const event = createTestEvent({ aggregateId: 'doc-abc' });
    await eventBus.subscriptions[0].handler(event);

    expect(embedDocument).toHaveBeenCalledOnce();
    expect(embedDocument).toHaveBeenCalledWith('doc-abc');
  });

  it('does not crash when embedDocument throws', async () => {
    embedDocument.mockRejectedValueOnce(new Error('Ollama down'));

    const consumer = createEmbeddingConsumer(eventBus.bus, embedDocument);
    await consumer.start();

    const event = createTestEvent();
    await expect(eventBus.subscriptions[0].handler(event)).resolves.toBeUndefined();
  });

  it('does not subscribe twice on double start', async () => {
    const consumer = createEmbeddingConsumer(eventBus.bus, embedDocument);
    await consumer.start();
    await consumer.start();

    expect(eventBus.subscriptions).toHaveLength(1);
  });

  it('stop marks consumer as stopped', async () => {
    const consumer = createEmbeddingConsumer(eventBus.bus, embedDocument);
    await consumer.start();
    consumer.stop();
    // No error — stop is a graceful no-op
  });
});
