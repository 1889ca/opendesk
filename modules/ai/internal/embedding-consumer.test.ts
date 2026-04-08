// TODO: Convert to integration tests with real DB (see contracts/testing/rules.md)
/** Contract: contracts/ai/rules.md */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmbeddingConsumer } from './embedding-consumer.ts';
import { EventType, type EventBusModule, type DomainEvent, type EventHandler } from '../../events/contract.ts';

function createStubEventBus() {
  const handlers: { group: string; types: string[]; handler: EventHandler }[] = [];
  return {
    handlers,
    subscribe: vi.fn(async (group: string, types: string[], handler: EventHandler) => {
      handlers.push({ group, types: types as string[], handler });
    }),
    // Stubs for the rest of EventBusModule
    emit: vi.fn(),
    acknowledge: vi.fn(),
    registerEventType: vi.fn(),
    startConsuming: vi.fn(),
    stopConsuming: vi.fn(),
    startBackgroundJobs: vi.fn(),
    stopBackgroundJobs: vi.fn(),
  } as unknown as EventBusModule & {
    handlers: { group: string; types: string[]; handler: EventHandler }[];
  };
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
  let eventBus: ReturnType<typeof createStubEventBus>;
  let embedDocument: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    eventBus = createStubEventBus();
    embedDocument = vi.fn().mockResolvedValue(5);
  });

  it('subscribes to StateFlushed with ai-embeddings consumer group', async () => {
    const consumer = createEmbeddingConsumer(eventBus, embedDocument);
    await consumer.start();

    expect(eventBus.subscribe).toHaveBeenCalledOnce();
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'ai-embeddings',
      [EventType.StateFlushed],
      expect.any(Function),
    );
  });

  it('calls embedDocument with the document ID from the event', async () => {
    const consumer = createEmbeddingConsumer(eventBus, embedDocument);
    await consumer.start();

    const event = createTestEvent({ aggregateId: 'doc-abc' });
    await eventBus.handlers[0].handler(event);

    expect(embedDocument).toHaveBeenCalledOnce();
    expect(embedDocument).toHaveBeenCalledWith('doc-abc');
  });

  it('does not crash when embedDocument throws', async () => {
    embedDocument.mockRejectedValueOnce(new Error('Ollama down'));

    const consumer = createEmbeddingConsumer(eventBus, embedDocument);
    await consumer.start();

    const event = createTestEvent();
    // Should not throw
    await expect(eventBus.handlers[0].handler(event)).resolves.toBeUndefined();
  });

  it('does not subscribe twice on double start', async () => {
    const consumer = createEmbeddingConsumer(eventBus, embedDocument);
    await consumer.start();
    await consumer.start();

    expect(eventBus.subscribe).toHaveBeenCalledOnce();
  });

  it('stop marks consumer as stopped', async () => {
    const consumer = createEmbeddingConsumer(eventBus, embedDocument);
    await consumer.start();
    consumer.stop();
    // No error — stop is a graceful no-op
  });
});
