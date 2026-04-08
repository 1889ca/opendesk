/** Contract: contracts/events/rules.md */
import type { Redis } from 'ioredis';
import type { EventType, EventHandler } from '../contract.ts';
import { readFromGroup, acknowledgeEvent, streamKeyForType } from './redis-streams.ts';
import type { CircuitBreaker } from './circuit-breaker.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('events:consumer');

export interface ConsumerRegistration {
  groupName: string;
  consumerName: string;
  eventTypes: EventType[];
  handler: EventHandler;
}

export interface ConsumerLoopState {
  running: boolean;
  breaker: CircuitBreaker;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Main consumer loop with circuit breaker protection. */
export function runConsumerLoop(
  redis: Redis,
  consumer: ConsumerRegistration,
  state: ConsumerLoopState,
): void {
  (async () => {
    while (state.running) {
      if (state.breaker.state() === 'open') {
        await runProbe(redis, consumer, state);
        continue;
      }

      await consumeOnce(redis, consumer, state);
    }
  })();
}

/** Single consumption pass across all subscribed event types. */
async function consumeOnce(
  redis: Redis,
  consumer: ConsumerRegistration,
  state: ConsumerLoopState,
): Promise<void> {
  for (const type of consumer.eventTypes) {
    if (!state.running) break;
    try {
      const key = streamKeyForType(type);
      const messages = await readFromGroup(
        redis, key, consumer.groupName,
        consumer.consumerName, 10, 2000,
      );

      // Successful read — reset failure counters and backoff
      state.breaker.recordSuccess();

      for (const { messageId, event } of messages) {
        try {
          await consumer.handler(event);
          await acknowledgeEvent(redis, key, consumer.groupName, messageId);
        } catch (err) {
          log.error('handler failed', {
            consumerGroup: consumer.groupName,
            eventId: event.id,
            error: String(err),
          });
        }
      }
    } catch (err) {
      const result = state.breaker.recordFailure(err);
      if ('opened' in result) {
        // Circuit just opened — skip to probe mode on next iteration
        return;
      }
      await sleep(result.backoffMs);
    }
  }
}

/** Probe Redis while the circuit is open. On success, close and resume. */
async function runProbe(
  redis: Redis,
  consumer: ConsumerRegistration,
  state: ConsumerLoopState,
): Promise<void> {
  await sleep(state.breaker.probeIntervalMs());
  if (!state.running) return;

  const probeType = consumer.eventTypes[0];
  const key = streamKeyForType(probeType);

  try {
    // Lightweight probe: try to read with a short block time
    await readFromGroup(
      redis, key, consumer.groupName,
      consumer.consumerName, 1, 500,
    );
    // Probe succeeded — close the circuit and resume
    state.breaker.recordSuccess();
    log.info('probe succeeded — resuming consumer', {
      consumerGroup: consumer.groupName,
    });
  } catch (err) {
    log.warn('probe failed — circuit remains open', {
      consumerGroup: consumer.groupName,
      error: String(err),
    });
  }
}
