/** Contract: contracts/app-slides/rules.md */

import {
  type AnimationEffect, type ElementAnimation, type AnimationStep,
  categoryOf,
} from './animation-types.ts';

/**
 * Runtime animation playback for presenter mode. Pure function over DOM —
 * never touches Yjs.
 *
 * Resolves each animation against a host map of `elementId -> HTMLElement`
 * and runs the matching keyframes via the Web Animations API.
 */

export type ElementResolver = (elementId: string) => HTMLElement | null;

const EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** Build the keyframes for an effect. Wipe and spin produce non-trivial transforms. */
export function keyframesFor(effect: AnimationEffect): Keyframe[] {
  switch (effect) {
    case 'fade-in': return [{ opacity: 0 }, { opacity: 1 }];
    case 'fly-in-left': return [{ opacity: 0, transform: 'translateX(-40%)' }, { opacity: 1, transform: 'translateX(0)' }];
    case 'fly-in-right': return [{ opacity: 0, transform: 'translateX(40%)' }, { opacity: 1, transform: 'translateX(0)' }];
    case 'fly-in-top': return [{ opacity: 0, transform: 'translateY(-40%)' }, { opacity: 1, transform: 'translateY(0)' }];
    case 'fly-in-bottom': return [{ opacity: 0, transform: 'translateY(40%)' }, { opacity: 1, transform: 'translateY(0)' }];
    case 'zoom-in': return [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }];
    case 'wipe-right': return [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }];
    case 'fade-out': return [{ opacity: 1 }, { opacity: 0 }];
    case 'fly-out-left': return [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: 'translateX(-40%)' }];
    case 'fly-out-right': return [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: 'translateX(40%)' }];
    case 'zoom-out': return [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.6)' }];
    case 'pulse': return [
      { transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' },
    ];
    case 'spin': return [
      { transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' },
    ];
  }
}

/** Final visual state after running this effect. Used to keep elements visible/hidden. */
function finalStateFor(effect: AnimationEffect): Partial<CSSStyleDeclaration> {
  const cat = categoryOf(effect);
  if (cat === 'entrance') return { opacity: '1' };
  if (cat === 'exit') return { opacity: '0' };
  return {};
}

/** Apply final state to element after animation finishes (without overriding existing transform). */
function commitFinalState(el: HTMLElement, effect: AnimationEffect): void {
  const state = finalStateFor(effect);
  for (const [k, v] of Object.entries(state)) {
    if (v != null) (el.style as unknown as Record<string, string>)[k] = String(v);
  }
}

/**
 * Initial pre-step setup: any element that has at least one entrance
 * animation must be hidden until that entrance plays.
 */
export function prepareInitialState(animations: ElementAnimation[], resolve: ElementResolver): void {
  const seen = new Set<string>();
  for (const a of animations) {
    if (categoryOf(a.effect) !== 'entrance' || seen.has(a.elementId)) continue;
    seen.add(a.elementId);
    const el = resolve(a.elementId);
    if (el) el.style.opacity = '0';
  }
}

/** Run a single animation. Returns a promise that resolves when its final state is committed. */
export function runAnimation(anim: ElementAnimation, resolve: ElementResolver): Promise<void> {
  const el = resolve(anim.elementId);
  if (!el) return Promise.resolve();
  const kf = keyframesFor(anim.effect);
  return new Promise((done) => {
    // Clear any prior hidden state so the animation start frame is visible.
    if (categoryOf(anim.effect) !== 'entrance') el.style.opacity = '';
    const animation = el.animate(kf, {
      duration: anim.durationMs,
      delay: anim.delayMs,
      easing: EASING,
      fill: 'forwards',
    });
    const finish = () => { commitFinalState(el, anim.effect); done(); };
    animation.onfinish = finish;
    animation.oncancel = finish;
  });
}

/**
 * Run a step. Items chained "after-previous" wait for the prior item; items
 * chained "with-previous" run in parallel. The first item in the step always
 * starts immediately (its trigger is the click that opened the step).
 */
export async function runStep(step: AnimationStep, resolve: ElementResolver): Promise<void> {
  // Group items into parallel lanes. A new lane begins on the first item or any after-previous.
  const lanes: ElementAnimation[][] = [];
  for (let i = 0; i < step.items.length; i++) {
    const a = step.items[i];
    if (i === 0 || a.trigger === 'after-previous') lanes.push([a]);
    else lanes[lanes.length - 1].push(a);
  }
  const lanePromises = lanes.map(async (lane) => {
    for (const item of lane) {
      await runAnimation(item, resolve);
    }
  });
  await Promise.all(lanePromises);
}

/**
 * Stateful controller that walks through a slide's steps. Use one per slide
 * instance in presenter mode. `next()` plays the next step (or returns
 * `done: true` when there are no steps left).
 */
export interface AnimationController {
  totalSteps: number;
  currentStep: number;
  next(): Promise<{ done: boolean }>;
  reset(): void;
}

export function createAnimationController(
  steps: AnimationStep[],
  animations: ElementAnimation[],
  resolve: ElementResolver,
): AnimationController {
  prepareInitialState(animations, resolve);
  let pos = 0;
  let busy = false;
  return {
    totalSteps: steps.length,
    get currentStep() { return pos; },
    async next() {
      if (busy) return { done: pos >= steps.length };
      if (pos >= steps.length) return { done: true };
      busy = true;
      try { await runStep(steps[pos], resolve); pos++; }
      finally { busy = false; }
      return { done: pos >= steps.length };
    },
    reset() {
      pos = 0;
      prepareInitialState(animations, resolve);
    },
  };
}
