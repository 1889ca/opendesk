/** Contract: contracts/events/rules.md */
import type { Redis } from 'ioredis';
import { DomainEventSchema, type DomainEvent, type EventType } from '../contract.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('events:streams');

const STREAM_PREFIX = 'opendesk:events:';

/** Get the Redis stream key for an event type. */
export function streamKeyForType(type: EventType): string {
  return `${STREAM_PREFIX}${type}`;
}

/** Publish an event to its Redis Stream via XADD. */
export async function publishToStream(
  redis: Redis,
  event: DomainEvent,
): Promise<string> {
  const key = streamKeyForType(event.type as EventType);
  const messageId = await redis.xadd(
    key,
    '*',
    'id', event.id,
    'type', event.type,
    'aggregateId', event.aggregateId,
    'revisionId', event.revisionId ?? '',
    'actorId', event.actorId,
    'actorType', event.actorType,
    'occurredAt', event.occurredAt,
  );
  return messageId ?? '';
}

/** Create a consumer group on a stream. No-op if group already exists. */
export async function createConsumerGroup(
  redis: Redis,
  streamKey: string,
  groupName: string,
): Promise<void> {
  try {
    await redis.xgroup('CREATE', streamKey, groupName, '0', 'MKSTREAM');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('BUSYGROUP')) throw err;
    // Group already exists — safe to ignore
  }
}

/** Read events from a consumer group. Returns parsed DomainEvents. */
export async function readFromGroup(
  redis: Redis,
  streamKey: string,
  groupName: string,
  consumerName: string,
  count: number,
  blockMs: number,
): Promise<Array<{ messageId: string; event: DomainEvent }>> {
  const result = await redis.xreadgroup(
    'GROUP', groupName, consumerName,
    'COUNT', count,
    'BLOCK', blockMs,
    'STREAMS', streamKey, '>',
  ) as Array<[string, Array<[string, string[]]>]> | null;
  if (!result) return [];

  const messages: Array<{ messageId: string; event: DomainEvent }> = [];
  for (const [, entries] of result) {
    for (const [messageId, fields] of entries) {
      const obj: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        obj[fields[i]] = fields[i + 1];
      }
      const parsed = DomainEventSchema.safeParse({
        id: obj.id,
        type: obj.type,
        aggregateId: obj.aggregateId,
        revisionId: obj.revisionId || undefined,
        actorId: obj.actorId,
        actorType: obj.actorType,
        occurredAt: obj.occurredAt,
      });
      if (parsed.success) {
        messages.push({ messageId, event: parsed.data });
      } else {
        log.warn('skipping malformed stream message', { messageId, error: parsed.error.message });
      }
    }
  }
  return messages;
}

/** Acknowledge a message in a consumer group. */
export async function acknowledgeEvent(
  redis: Redis,
  streamKey: string,
  groupName: string,
  messageId: string,
): Promise<void> {
  await redis.xack(streamKey, groupName, messageId);
}
