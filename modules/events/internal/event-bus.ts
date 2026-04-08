/** Contract: contracts/events/rules.md */
import type { Pool, PoolClient } from 'pg';
import type { Redis } from 'ioredis';
import {
  DomainEventSchema,
  type DomainEvent,
  type EventType,
  type EventHandler,
  type EventBusModule,
} from '../contract.ts';
import { insertOutboxEntry } from './outbox-store.ts';
import { markPublished } from './outbox-store.ts';
import { registerType, getOwner } from './schema-registry.ts';
import {
  publishToStream,
  createConsumerGroup,
  readFromGroup,
  acknowledgeEvent,
  streamKeyForType,
} from './redis-streams.ts';
import { startOutboxPoller, type OutboxPollerHandle } from './outbox-poller.ts';
import { startPruner, type PrunerHandle } from './pruner.ts';

interface ConsumerRegistration {
  groupName: string;
  consumerName: string;
  eventTypes: EventType[];
  handler: EventHandler;
}

/** Create the EventBus module with full lifecycle management. */
export function createEventBus(pool: Pool, redis: Redis): EventBusModule {
  const consumers: ConsumerRegistration[] = [];
  const activeLoops = new Map<string, { running: boolean }>();
  let pollerHandle: OutboxPollerHandle | null = null;
  let prunerHandle: PrunerHandle | null = null;

  async function emit(event: DomainEvent, pgTransaction: PoolClient | null): Promise<void> {
    DomainEventSchema.parse(event);

    if (pgTransaction) {
      // Transactional: insert within caller's transaction
      await insertOutboxEntry(pgTransaction, event);
    } else {
      // Standalone: use pool directly
      const client = await pool.connect();
      try {
        await insertOutboxEntry(client, event);
      } finally {
        client.release();
      }
    }

    // Fire-and-forget publish to Redis; outbox poller retries on failure
    try {
      await publishToStream(redis, event);
      await markPublished(pool, [event.id]);
    } catch {
      // Redis unavailable — outbox poller will handle it
    }
  }

  async function subscribe(
    consumerGroup: string,
    eventTypes: EventType[],
    handler: EventHandler,
  ): Promise<void> {
    for (const type of eventTypes) {
      const key = streamKeyForType(type);
      await createConsumerGroup(redis, key, consumerGroup);
    }
    consumers.push({
      groupName: consumerGroup,
      consumerName: `${consumerGroup}-${process.pid}`,
      eventTypes,
      handler,
    });
  }

  async function acknowledge(consumerGroup: string, eventId: string): Promise<void> {
    // Find which streams this group is subscribed to and ACK on all
    const consumer = consumers.find((c) => c.groupName === consumerGroup);
    if (!consumer) return;
    for (const type of consumer.eventTypes) {
      const key = streamKeyForType(type);
      try {
        await acknowledgeEvent(redis, key, consumerGroup, eventId);
      } catch {
        // May not exist in this stream — safe to ignore
      }
    }
  }

  async function registerEventType(type: EventType, ownerModule: string): Promise<void> {
    await registerType(pool, type, ownerModule);
  }

  function startConsuming(): void {
    for (const consumer of consumers) {
      const loopKey = consumer.groupName;
      if (activeLoops.has(loopKey)) continue;

      const state = { running: true };
      activeLoops.set(loopKey, state);

      (async () => {
        while (state.running) {
          for (const type of consumer.eventTypes) {
            if (!state.running) break;
            try {
              const key = streamKeyForType(type);
              const messages = await readFromGroup(
                redis, key, consumer.groupName,
                consumer.consumerName, 10, 2000,
              );
              for (const { messageId, event } of messages) {
                try {
                  await consumer.handler(event);
                  await acknowledgeEvent(redis, key, consumer.groupName, messageId);
                } catch (err) {
                  console.error(
                    `[events:consumer:${consumer.groupName}] handler failed for ${event.id}:`, err,
                  );
                }
              }
            } catch (err) {
              console.error(`[events:consumer:${consumer.groupName}] read failed:`, err);
              // Back off on error
              await new Promise((r) => setTimeout(r, 3000));
            }
          }
        }
      })();
    }
  }

  function stopConsuming(): void {
    for (const [key, state] of activeLoops) {
      state.running = false;
      activeLoops.delete(key);
    }
  }

  function startBackgroundJobs(): void {
    if (!pollerHandle) pollerHandle = startOutboxPoller(pool, redis);
    if (!prunerHandle) prunerHandle = startPruner(pool);
  }

  function stopBackgroundJobs(): void {
    pollerHandle?.stop();
    pollerHandle = null;
    prunerHandle?.stop();
    prunerHandle = null;
  }

  return {
    emit,
    subscribe,
    acknowledge,
    registerEventType,
    startConsuming,
    stopConsuming,
    startBackgroundJobs,
    stopBackgroundJobs,
  };
}
