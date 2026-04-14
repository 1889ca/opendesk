/** Contract: contracts/app/rules.md */
/**
 * Editor lifecycle helpers — safe primitives for observers, listeners, and timers.
 *
 * Every editor component that registers listeners should use these helpers
 * so teardown is automatic and common pitfalls (observer loops, leaked
 * listeners, unbounded retries) are impossible by construction.
 */

import type { Editor } from '@tiptap/core';

/** A function that tears down a single subscription. */
export type Disposer = () => void;

// ─── Scope ───────────────────────────────────────────────────────

/** Collects disposable subscriptions; `dispose()` tears them all down. */
export interface Scope {
  /** Register an arbitrary cleanup function. */
  add(disposer: Disposer): void;
  /** Subscribe to a TipTap editor event; auto-unsubscribes on dispose. */
  onEditor(editor: Editor, event: string, handler: (...args: any[]) => void): void;
  /** addEventListener on document; auto-removes on dispose. */
  onDocument(event: string, handler: EventListener, options?: AddEventListenerOptions): void;
  /** addEventListener on an element; auto-removes on dispose. */
  onElement(el: EventTarget, event: string, handler: EventListener, options?: AddEventListenerOptions): void;
  /** Tear down all registered subscriptions. Idempotent — safe to call twice. */
  dispose(): void;
}

export function createScope(): Scope {
  const disposers: Disposer[] = [];
  let disposed = false;

  return {
    add(d) {
      if (disposed) return;
      disposers.push(d);
    },
    onEditor(editor, event, handler) {
      (editor as any).on(event, handler);
      this.add(() => (editor as any).off(event, handler));
    },
    onDocument(event, handler, options) {
      document.addEventListener(event, handler, options);
      this.add(() => document.removeEventListener(event, handler, options));
    },
    onElement(el, event, handler, options) {
      el.addEventListener(event, handler, options);
      this.add(() => el.removeEventListener(event, handler, options));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (let i = disposers.length - 1; i >= 0; i--) disposers[i]();
      disposers.length = 0;
    },
  };
}

// ─── Safe ResizeObserver ─────────────────────────────────────────

export interface SafeObserver {
  observer: ResizeObserver;
  disconnect: Disposer;
}

/**
 * Creates a ResizeObserver that guards against infinite loops when the
 * callback mutates the geometry of observed elements.
 *
 * Stores the last observed sizes and skips the callback when they haven't
 * changed, breaking the loop that occurs when `observe()` fires an initial
 * notification after disconnect/reconnect.
 */
export function safeResizeObserver(
  targets: Element | Element[],
  callback: (entries: ResizeObserverEntry[]) => void,
): SafeObserver {
  const arr = Array.isArray(targets) ? targets : [targets];
  const lastSizes = new Map<Element, { w: number; h: number }>();

  const observer = new ResizeObserver((entries) => {
    // Only invoke callback if at least one target actually changed size.
    let changed = false;
    for (const entry of entries) {
      const box = entry.contentBoxSize?.[0];
      const w = box?.inlineSize ?? entry.contentRect.width;
      const h = box?.blockSize ?? entry.contentRect.height;
      const prev = lastSizes.get(entry.target);
      if (!prev || prev.w !== w || prev.h !== h) {
        lastSizes.set(entry.target, { w, h });
        changed = true;
      }
    }
    if (changed) callback(entries);
  });

  for (const t of arr) observer.observe(t);
  return { observer, disconnect: () => { observer.disconnect(); lastSizes.clear(); } };
}

// ─── Bounded rAF retry ──────────────────────────────────────────

/**
 * Calls `predicate` each animation frame. When it returns a non-nullish
 * value, passes that value to `callback` and stops. Gives up silently
 * after `maxAttempts` frames (default 60 ≈ 1 second).
 */
export function retryUntil<T>(
  predicate: () => T | null | undefined,
  callback: (value: T) => void,
  maxAttempts = 60,
): { cancel: Disposer } {
  let attempts = 0;
  let id = 0;
  const tick = () => {
    const value = predicate();
    if (value != null) { callback(value); return; }
    if (++attempts >= maxAttempts) return;
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return { cancel: () => cancelAnimationFrame(id) };
}

// ─── Debounce ────────────────────────────────────────────────────

export interface Debounced<T extends (...args: any[]) => void> {
  call: (...args: Parameters<T>) => void;
  cancel: Disposer;
}

// ─── Batched rAF update ──────────────────────────────────────────

/**
 * Coalesces rapid calls into a single `requestAnimationFrame` callback.
 * No matter how many times `call()` fires in one frame (e.g. 50+
 * transaction handlers), `fn` runs at most once per frame.
 */
export function batchRaf(fn: () => void): { call: () => void; cancel: Disposer } {
  let id = 0;
  return {
    call: () => {
      if (id) return;
      id = requestAnimationFrame(() => { id = 0; fn(); });
    },
    cancel: () => { if (id) { cancelAnimationFrame(id); id = 0; } },
  };
}

// ─── Debounce ────────────────────────────────────────────────────

/** Debounce with an explicit `cancel` handle for lifecycle cleanup. */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  ms: number,
): Debounced<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    call: ((...args: Parameters<T>) => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; fn(...args); }, ms);
    }) as (...args: Parameters<T>) => void,
    cancel: () => { if (timer !== null) { clearTimeout(timer); timer = null; } },
  };
}
