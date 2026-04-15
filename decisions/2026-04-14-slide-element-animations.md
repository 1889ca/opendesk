# Decision: Per-element animations for slides (entrance, exit, emphasis)

**Date:** 2026-04-14
**Status:** Accepted (implemented in `claude/zen-cray-2lrdx`)
**Module:** `app-slides`

## Context

The slides editor already supports per-slide transitions (fade, slide, zoom),
but every slide is rendered all-at-once. PowerPoint and Keynote both let
authors animate individual elements: a bullet point flies in on click, an
image fades out, a chart pulses for emphasis. This is one of the largest
remaining feature gaps versus Microsoft Office for presentations and is
heavily used in real-world decks (training, sales, education).

## Decision

Add a self-contained animation subsystem to `modules/app-slides/`:

1. **Storage** — each slide map carries an optional `Y.Array<Y.Map<unknown>>`
   under the key `'animations'`. Order in the array is the playback order.
   Each row has `{ id, elementId, effect, trigger, durationMs, delayMs }`.
2. **Effects (13 to start)** — entrance: `fade-in`, `fly-in-{left,right,top,bottom}`,
   `zoom-in`, `wipe-right`. Exit: `fade-out`, `fly-out-{left,right}`, `zoom-out`.
   Emphasis: `pulse`, `spin`. Easy to extend the catalog later.
3. **Triggers** — `on-click`, `with-previous`, `after-previous`. The trigger
   defines how this animation joins playback steps relative to the prior one.
4. **Step grouping** — `buildAnimationSteps` walks the array and opens a new
   step on each `on-click`. `with-previous` joins the open step's parallel
   lane; `after-previous` chains sequentially within the same step.
5. **Engine** — pure DOM, Web Animations API. Hides any element with an
   entrance animation in `prepareInitialState` so it doesn't flash visible
   before its entrance plays.
6. **Editor UI** — sidebar panel beside the canvas. Add by selecting an
   element and picking an effect; per-row controls for effect, trigger,
   duration, delay, reorder, and remove.
7. **Presenter integration** — `Right Arrow` / `Space` first advances through
   the current slide's animation steps; only after the last step does it
   navigate to the next slide.

## Alternatives considered

- **Store animations on the element itself** (as part of `SlideElement`).
  Rejected: animation order is a slide-level concern, multiple animations on
  one element need their own playback ordering, and pruning on element
  delete becomes harder when the row of truth moves with the element.
- **CSS-only keyframes** (no Web Animations API). Rejected: the engine needs
  programmatic completion callbacks for `after-previous` chaining, and
  WAAPI cancellation is cleaner than chasing `animationend` events.
- **One large `animation-panel.ts`** (~250 lines). Rejected to honor the
  200-line file budget — extracted small DOM control factories into
  `animation-panel-controls.ts` and toolbar wiring into `animation-init.ts`.

## What we did NOT do (yet)

- **Motion paths** — drawing a path the element follows. Powerful but
  requires a path editor; out of scope for the first cut.
- **Animation triggers from element clicks** ("on click of shape X, animate
  shape Y"). Adds graph traversal complexity. Defer.
- **Repeat / autoreverse** beyond the built-in pulse/spin. Easy to add via
  the keyframes layer when needed.
- **Per-animation easing override.** All animations currently use a single
  cubic-bezier ease-out. Per-row easing is a one-line addition when needed.

## Module structure

New files (all under the 200-line contract budget):

| File | Lines | Purpose |
| --- | --- | --- |
| `internal/animation-types.ts` | 102 | Effect catalog, trigger types, step type, defaults, type guards |
| `internal/animation-yjs.ts` | ~190 | List/append/update/remove/move/prune helpers + step-builder |
| `internal/animation-engine.ts` | ~150 | Keyframes, prepareInitialState, runStep, controller |
| `internal/animation-panel.ts` | ~197 | Sidebar UI |
| `internal/animation-panel-controls.ts` | 67 | Select / number-input / icon-button factories |
| `internal/animation-init.ts` | 66 | Mount panel + toolbar toggle |
| `internal/css/animations.css` | ~170 | Panel styles |
| `internal/animation-yjs.test.ts` | ~180 | Yjs round-trip + step grouping tests |
| `internal/animation-engine.test.ts` | ~170 | Engine tests with fake-element resolver |

## Testing

- `animation-yjs.test.ts` — 16 tests covering append/list/update/remove/move/
  prune and `buildAnimationSteps` step grouping.
- `animation-engine.test.ts` — 14 tests covering keyframe shape,
  prepareInitialState idempotency, parallel vs. sequential step execution,
  and controller state transitions. Engine tests use fake-element objects
  so they run without jsdom.

All tests pass. No existing tests changed.

## Risks

- **Element resolver coupling.** The engine queries by `data-element-id` on
  the rendered DOM. If `element-renderer.ts` ever stopped emitting that
  attribute, animations would silently no-op. The contract already requires
  this attribute (Invariant 3), so the risk is low.
- **Yjs Y.Map re-insertion.** Reordering can't re-insert the same Y.Map after
  delete. `moveAnimation` snapshots rows to plain objects and rebuilds the
  array — covered by tests.
- **Stale animation rows on element delete.** Mitigated by
  `pruneAnimationsForMissingElements` invoked from the editor's
  `observeDeep` callback.
