/** Contract: contracts/app/rules.md */

/**
 * Touch-friendly interactions for mobile devices.
 * - Ensures viewport meta tag is present
 * - Handles long-press for context menus
 * - Prevents iOS zoom on input focus (handled via CSS font-size >= 16px)
 */

/** Ensure the viewport meta tag exists with correct content. */
export function ensureViewportMeta(): void {
  const existing = document.querySelector('meta[name="viewport"]');
  if (existing) return;

  const meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = 'width=device-width, initial-scale=1';
  document.head.appendChild(meta);
}

/** Returns true if the device supports touch. */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/** Returns true if viewport width is at or below the mobile breakpoint. */
export function isMobileViewport(breakpoint = 768): boolean {
  return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
}

/**
 * Attach a long-press handler to an element.
 * Calls the callback after `duration` ms of continuous touch.
 */
export function onLongPress(
  el: HTMLElement,
  callback: (e: TouchEvent) => void,
  duration = 500,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function start(e: TouchEvent) {
    timer = setTimeout(() => {
      callback(e);
      timer = null;
    }, duration);
  }

  function cancel() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchend', cancel, { passive: true });
  el.addEventListener('touchmove', cancel, { passive: true });
  el.addEventListener('touchcancel', cancel, { passive: true });

  return () => {
    el.removeEventListener('touchstart', start);
    el.removeEventListener('touchend', cancel);
    el.removeEventListener('touchmove', cancel);
    el.removeEventListener('touchcancel', cancel);
  };
}

/**
 * Initialize all touch support features.
 * Safe to call on desktop (no-ops if touch is not available).
 */
export function initTouchSupport(): void {
  ensureViewportMeta();
}
