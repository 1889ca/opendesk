/** Contract: contracts/permissions/rules.md */

import { randomUUID } from 'node:crypto';
import type { GrantStore } from './grant-store.ts';
import { EventType, type EventBus, type DomainEvent } from '../../events/index.ts';

/**
 * Wraps any GrantStore to emit GrantCreated / GrantRevoked domain events
 * after successful persistence. The underlying store handles all storage;
 * this layer only adds event emission.
 *
 * Pass `null` for eventBus to get a no-op wrapper (useful in tests).
 */
export function withGrantEvents(
  inner: GrantStore,
  eventBus: EventBus | null,
): GrantStore {
  if (!eventBus) return inner;

  return {
    ...inner,

    async create(def) {
      const grant = await inner.create(def);

      const event: DomainEvent = {
        id: randomUUID(),
        type: EventType.GrantCreated,
        aggregateId: grant.resourceId,
        actorId: grant.grantedBy,
        actorType: 'system',
        occurredAt: new Date().toISOString(),
      };
      await eventBus.emit(event, null);

      return grant;
    },

    async updateGrantRole(grantId, newRole) {
      const updated = await inner.updateGrantRole(grantId, newRole);

      if (updated) {
        const event: DomainEvent = {
          id: randomUUID(),
          type: EventType.GrantCreated,
          aggregateId: updated.resourceId,
          actorId: updated.grantedBy,
          actorType: 'system',
          occurredAt: new Date().toISOString(),
        };
        await eventBus.emit(event, null);
      }

      return updated;
    },

    async revoke(grantId) {
      // Look up the grant before deletion so we have context for the event.
      const grant = await inner.findById(grantId);
      const deleted = await inner.revoke(grantId);

      if (deleted && grant) {
        const event: DomainEvent = {
          id: randomUUID(),
          type: EventType.GrantRevoked,
          aggregateId: grant.resourceId,
          // revisionId carries the grantee principal ID so subscribers
          // (e.g. collab) can close only that user's connections without
          // importing the sharing or permissions modules directly.
          revisionId: grant.principalId,
          actorId: grant.grantedBy,
          actorType: 'system',
          occurredAt: new Date().toISOString(),
        };
        await eventBus.emit(event, null);
      }

      return deleted;
    },
  };
}
