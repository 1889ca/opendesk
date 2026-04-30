/** Contract: contracts/api/rules.md */

import type { DomainEvent } from '../../events/contract.ts';

export type SseListener = (event: DomainEvent) => void;

/**
 * Lightweight in-process pub/sub hub for SSE clients.
 *
 * One EventBus consumer group feeds this hub; it fans out to every
 * registered SSE listener. This avoids creating one Redis consumer
 * group per connected browser tab.
 */
export interface SseFanout {
  /** Register a listener. Returns an unsubscribe function. */
  on(listener: SseListener): () => void;
  /** Broadcast an event to all registered listeners. */
  emit(event: DomainEvent): void;
  /** Number of currently registered listeners (for diagnostics). */
  listenerCount(): number;
}

/** Create an in-process SSE fanout hub. */
export function createSseFanout(): SseFanout {
  const listeners = new Set<SseListener>();

  return {
    on(listener: SseListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    emit(event: DomainEvent) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // A broken SSE connection throws; the 'close' handler will clean it up
        }
      }
    },

    listenerCount() {
      return listeners.size;
    },
  };
}
