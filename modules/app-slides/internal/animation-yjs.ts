/** Contract: contracts/app-slides/rules.md */

import * as Y from 'yjs';
import {
  type AnimationEffect, type AnimationTrigger, type ElementAnimation, type AnimationStep,
  DEFAULT_DURATION_MS, DEFAULT_DELAY_MS, MIN_DURATION_MS, MAX_DURATION_MS,
  isAnimationEffect, isAnimationTrigger,
} from './animation-types.ts';

/**
 * Read/write helpers for per-slide element animations.
 *
 * Storage: each slide map carries an optional `'animations'` field holding a
 * `Y.Array<Y.Map<unknown>>`. Order in the array is the playback order — it
 * matters for `with-previous` and `after-previous` triggers.
 */

const ANIMATIONS_KEY = 'animations';

/** Resolve (or create) the animations array for a slide. */
function getOrCreateYAnimations(
  ydoc: Y.Doc,
  slide: Y.Map<unknown>,
): Y.Array<Y.Map<unknown>> {
  let arr = slide.get(ANIMATIONS_KEY) as Y.Array<Y.Map<unknown>> | undefined;
  if (!arr) {
    ydoc.transact(() => {
      arr = new Y.Array<Y.Map<unknown>>();
      slide.set(ANIMATIONS_KEY, arr);
    });
  }
  return arr!;
}

/** Resolve the animations array, returning null when absent. */
export function getYAnimations(slide: Y.Map<unknown> | undefined): Y.Array<Y.Map<unknown>> | null {
  if (!slide) return null;
  const arr = slide.get(ANIMATIONS_KEY);
  return arr instanceof Y.Array ? arr as Y.Array<Y.Map<unknown>> : null;
}

function clampDuration(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_DURATION_MS;
  return Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, Math.round(n)));
}

function clampDelay(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(MAX_DURATION_MS, Math.round(n));
}

/** Parse a Y.Map row into a typed ElementAnimation, returning null on invalid data. */
export function parseAnimation(yrow: Y.Map<unknown>): ElementAnimation | null {
  const id = yrow.get('id'); const elementId = yrow.get('elementId');
  const effect = yrow.get('effect'); const trigger = yrow.get('trigger');
  if (typeof id !== 'string' || typeof elementId !== 'string') return null;
  if (!isAnimationEffect(effect) || !isAnimationTrigger(trigger)) return null;
  const dur = yrow.get('durationMs'); const del = yrow.get('delayMs');
  return {
    id, elementId, effect, trigger,
    durationMs: clampDuration(typeof dur === 'number' ? dur : DEFAULT_DURATION_MS),
    delayMs: clampDelay(typeof del === 'number' ? del : DEFAULT_DELAY_MS),
  };
}

/** List all animations for a slide in playback order. Invalid rows are skipped. */
export function listAnimations(slide: Y.Map<unknown> | undefined): ElementAnimation[] {
  const yarr = getYAnimations(slide);
  if (!yarr) return [];
  const out: ElementAnimation[] = [];
  for (let i = 0; i < yarr.length; i++) {
    const parsed = parseAnimation(yarr.get(i));
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Append a new animation to the slide. Returns the created animation. */
export function appendAnimation(
  ydoc: Y.Doc,
  slide: Y.Map<unknown>,
  init: { elementId: string; effect: AnimationEffect; trigger?: AnimationTrigger; durationMs?: number; delayMs?: number },
): ElementAnimation {
  const anim: ElementAnimation = {
    id: crypto.randomUUID(),
    elementId: init.elementId,
    effect: init.effect,
    trigger: init.trigger ?? 'on-click',
    durationMs: clampDuration(init.durationMs ?? DEFAULT_DURATION_MS),
    delayMs: clampDelay(init.delayMs ?? DEFAULT_DELAY_MS),
  };
  const yarr = getOrCreateYAnimations(ydoc, slide);
  ydoc.transact(() => {
    const yrow = new Y.Map<unknown>();
    yrow.set('id', anim.id); yrow.set('elementId', anim.elementId);
    yrow.set('effect', anim.effect); yrow.set('trigger', anim.trigger);
    yrow.set('durationMs', anim.durationMs); yrow.set('delayMs', anim.delayMs);
    yarr.push([yrow]);
  });
  return anim;
}

function findIndex(yarr: Y.Array<Y.Map<unknown>>, id: string): number {
  for (let i = 0; i < yarr.length; i++) if (yarr.get(i).get('id') === id) return i;
  return -1;
}

/** Update a single field on an animation row. */
export function updateAnimationField(
  ydoc: Y.Doc, slide: Y.Map<unknown>, id: string,
  field: 'effect' | 'trigger' | 'durationMs' | 'delayMs', value: unknown,
): void {
  const yarr = getYAnimations(slide); if (!yarr) return;
  const idx = findIndex(yarr, id); if (idx < 0) return;
  let coerced: unknown = value;
  if (field === 'effect' && !isAnimationEffect(value)) return;
  if (field === 'trigger' && !isAnimationTrigger(value)) return;
  if (field === 'durationMs') coerced = clampDuration(Number(value));
  if (field === 'delayMs') coerced = clampDelay(Number(value));
  ydoc.transact(() => { yarr.get(idx).set(field, coerced); });
}

/** Remove a single animation row by id. */
export function removeAnimation(ydoc: Y.Doc, slide: Y.Map<unknown>, id: string): void {
  const yarr = getYAnimations(slide); if (!yarr) return;
  const idx = findIndex(yarr, id); if (idx < 0) return;
  ydoc.transact(() => { yarr.delete(idx, 1); });
}

/** Move an animation to a new index. Used to reorder playback. */
export function moveAnimation(
  ydoc: Y.Doc, slide: Y.Map<unknown>, fromIdx: number, toIdx: number,
): void {
  const yarr = getYAnimations(slide); if (!yarr) return;
  if (fromIdx < 0 || fromIdx >= yarr.length || toIdx < 0 || toIdx >= yarr.length || fromIdx === toIdx) return;
  // Snapshot existing rows as plain JSON, then rebuild the array. Yjs does
  // not permit re-inserting deleted Y.Maps, so we clone every row.
  const snapshot: Array<Record<string, unknown>> = [];
  for (let i = 0; i < yarr.length; i++) {
    const row = yarr.get(i);
    const plain: Record<string, unknown> = {};
    row.forEach((v, k) => { plain[k] = v; });
    snapshot.push(plain);
  }
  const [moved] = snapshot.splice(fromIdx, 1);
  snapshot.splice(toIdx, 0, moved);
  ydoc.transact(() => {
    yarr.delete(0, yarr.length);
    for (const plain of snapshot) {
      const row = new Y.Map<unknown>();
      for (const [k, v] of Object.entries(plain)) row.set(k, v);
      yarr.push([row]);
    }
  });
}

/** Remove every animation that targets a missing element id. */
export function pruneAnimationsForMissingElements(
  ydoc: Y.Doc, slide: Y.Map<unknown>, validElementIds: Set<string>,
): void {
  const yarr = getYAnimations(slide); if (!yarr) return;
  const stale: number[] = [];
  for (let i = 0; i < yarr.length; i++) {
    const eid = yarr.get(i).get('elementId');
    if (typeof eid !== 'string' || !validElementIds.has(eid)) stale.push(i);
  }
  if (stale.length === 0) return;
  ydoc.transact(() => {
    for (let i = stale.length - 1; i >= 0; i--) yarr.delete(stale[i], 1);
  });
}

/**
 * Group animations into playback steps.
 *
 * Each `on-click` opens a new step. `with-previous` and `after-previous` join
 * the current open step. If the very first animation is not `on-click`, it
 * still starts step 0 (there is nothing prior to wait for).
 */
export function buildAnimationSteps(animations: ElementAnimation[]): AnimationStep[] {
  const steps: AnimationStep[] = [];
  for (const anim of animations) {
    if (steps.length === 0 || anim.trigger === 'on-click') {
      steps.push({ index: steps.length, items: [anim] });
    } else {
      steps[steps.length - 1].items.push(anim);
    }
  }
  return steps;
}
