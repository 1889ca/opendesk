# Mobile Contract

## Purpose

Responsive layout and touch interaction support for mobile devices, including toolbar overflow management and viewport configuration.

## Inputs / Outputs

**Inputs:**
- Viewport resize events (ResizeObserver on toolbar)
- Touch events (touchstart, touchend, touchmove, touchcancel)
- `window.matchMedia` queries for breakpoint detection

**Outputs:**
- Toolbar buttons reflowed into overflow dropdown when space is insufficient
- Viewport meta tag ensured in `<head>`
- Long-press callback invocations

## Components

### Touch Support (`touch-support.ts`)
- `ensureViewportMeta()` — adds `<meta name="viewport" content="width=device-width, initial-scale=1">` if not present
- `isTouchDevice()` — detects touch capability via `ontouchstart` or `maxTouchPoints`
- `isMobileViewport(breakpoint=768)` — checks if viewport width is at or below breakpoint
- `onLongPress(el, callback, duration=500)` — attaches long-press handler (500ms default), returns cleanup function
- `initTouchSupport()` — calls `ensureViewportMeta()`, safe to call on desktop (no-ops)
- All touch event listeners use `{ passive: true }`

### Toolbar Overflow (`toolbar-overflow.ts`)
- `setupToolbarOverflow(toolbar)` — attaches ResizeObserver, returns cleanup function
- Creates an overflow wrapper with `"..."` trigger button and dropdown menu
- Measures available toolbar width, reserves 48px for the overflow button
- Moves buttons that don't fit into the overflow dropdown
- Priority system: formatting buttons (bold, italic, strike, code, headings) stay visible longer
- Low-priority buttons overflow first, sorted into the dropdown
- Dropdown closes on outside click
- Re-flows on locale change (button labels may change width)
- Overflow trigger has `aria-label` for accessibility

## Invariants

- MUST: default mobile breakpoint is 768px
- MUST: long-press duration defaults to 500ms
- MUST: cancel long-press on touchmove or touchcancel (prevents false triggers on scroll)
- MUST: use `{ passive: true }` for all touch event listeners
- MUST: return cleanup functions from `onLongPress` and `setupToolbarOverflow`
- MUST: keep high-priority toolbar buttons (bold, italic, strike, code, h1-h3) visible as long as possible
- MUST: reserve 48px for the overflow trigger button in width calculations
- MUST: close overflow menu on outside click
- MUST: re-flow toolbar on locale change via `onLocaleChange` callback
- MUST NOT: prevent default on touch events (passive listeners)

## Dependencies

- `i18n` — `t()` for overflow button label, `onLocaleChange` for re-flow on locale switch

## Verification

- Unit test: `isMobileViewport()` returns true below breakpoint, false above
- Unit test: `isTouchDevice()` detects touch capability
- Unit test: `onLongPress` fires callback after duration, cancels on move
- Unit test: `ensureViewportMeta` creates meta tag if missing, skips if present
- Visual test: toolbar overflows buttons into dropdown at narrow widths
- Visual test: high-priority buttons remain visible when space is limited

## MVP Scope

Implemented:
- [x] Viewport meta tag injection
- [x] Touch device and mobile viewport detection
- [x] Long-press handler with cleanup
- [x] Toolbar overflow with ResizeObserver and priority system
- [x] Overflow dropdown with outside-click dismissal
- [x] Passive touch event listeners
- [x] Locale-reactive toolbar re-flow
