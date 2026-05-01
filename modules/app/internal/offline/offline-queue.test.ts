/** Contract: contracts/app/offline.md */

/**
 * Tests for offline queue and connection state management.
 *
 * IndexedDB-dependent paths are tested via a vi.stubGlobal approach that
 * exercises the graceful degradation contract: if IndexedDB is unavailable
 * the editor must not throw and must operate in no-persistence mode.
 *
 * Pure-logic paths (state machine, queue count) are tested without any
 * browser API dependency.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Connection state machine (offline-indicator.ts) ─────────────────────────

describe('connection state machine', () => {
  // Module is stateful — re-import fresh each suite via factory
  let mod: typeof import('./offline-indicator.ts');

  beforeEach(async () => {
    // Provide a stub for navigator.onLine (not available in Node)
    vi.stubGlobal('navigator', { onLine: true });
    // Re-import so module-level `currentState` is re-initialised
    mod = await import('./offline-indicator.ts');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('starts online when navigator.onLine is true', () => {
    expect(mod.getConnectionState()).toBe('online');
  });

  it('setConnectionState transitions correctly', () => {
    mod.setConnectionState('offline');
    expect(mod.getConnectionState()).toBe('offline');

    mod.setConnectionState('syncing');
    expect(mod.getConnectionState()).toBe('syncing');

    mod.setConnectionState('online');
    expect(mod.getConnectionState()).toBe('online');
  });

  it('does not notify listeners when state is unchanged', () => {
    mod.setConnectionState('online');
    const listener = vi.fn();
    mod.onConnectionStateChange(listener);

    mod.setConnectionState('online'); // same state — no notification
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies all listeners on state change', () => {
    const a = vi.fn();
    const b = vi.fn();
    mod.onConnectionStateChange(a);
    mod.onConnectionStateChange(b);

    mod.setConnectionState('offline');
    expect(a).toHaveBeenCalledOnce();
    expect(a).toHaveBeenCalledWith('offline');
    expect(b).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledWith('offline');
  });
});

// ─── Yjs queue count (setYjsQueueCount) ──────────────────────────────────────

describe('Yjs queue count', () => {
  let mod: typeof import('./offline-indicator.ts');

  beforeEach(async () => {
    vi.stubGlobal('navigator', { onLine: true });
    mod = await import('./offline-indicator.ts');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('setYjsQueueCount does not throw with zero', () => {
    expect(() => mod.setYjsQueueCount(0)).not.toThrow();
  });

  it('setYjsQueueCount does not throw with positive count', () => {
    expect(() => mod.setYjsQueueCount(42)).not.toThrow();
  });
});

// ─── yjs-persistence graceful degradation ────────────────────────────────────

describe('yjs-persistence graceful degradation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('returns a no-op handle when indexedDB is undefined', async () => {
    // Simulate environments where IndexedDB is not available
    vi.stubGlobal('indexedDB', undefined);

    const { attachYjsPersistence } = await import('./yjs-persistence.ts');
    const Y = await import('yjs');
    const doc = new Y.Doc();

    const handle = await attachYjsPersistence(doc, 'test-doc-no-idb');

    // no-op handle must expose all methods without throwing
    expect(typeof handle.detach).toBe('function');
    expect(typeof handle.clear).toBe('function');
    expect(typeof handle.compact).toBe('function');

    expect(() => handle.detach()).not.toThrow();
    await expect(handle.clear()).resolves.toBeUndefined();
    await expect(handle.compact()).resolves.toBeUndefined();
  });
});

// ─── sync-manager queue count ────────────────────────────────────────────────

describe('sync-manager onQueueChange subscription', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('registers queue change callbacks without throwing', async () => {
    // We cannot exercise IndexedDB operations in vitest/Node, but we can
    // verify that subscribing to queue change events is safe.
    const { onQueueChange } = await import('./sync-manager.ts');
    const cb = vi.fn();
    expect(() => onQueueChange(cb)).not.toThrow();
  });
});
