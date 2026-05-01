/** Contract: contracts/app-slides/rules.md */

/**
 * Element animation types and effect catalog. Pure data: no DOM, no Yjs.
 *
 * Animations attach to slide elements and play during a presentation. Each
 * animation has an effect (the visual transform), a trigger (when it starts
 * relative to neighbors), a duration, and a delay.
 */

export type AnimationEffect =
  // Entrance — element appears
  | 'fade-in' | 'fly-in-left' | 'fly-in-right' | 'fly-in-top' | 'fly-in-bottom'
  | 'zoom-in' | 'wipe-right'
  // Exit — element disappears
  | 'fade-out' | 'fly-out-left' | 'fly-out-right' | 'zoom-out'
  // Emphasis — element draws attention without entering or exiting
  | 'pulse' | 'spin';

export type AnimationTrigger = 'on-click' | 'with-previous' | 'after-previous';

export type AnimationCategory = 'entrance' | 'exit' | 'emphasis';

export type ElementAnimation = {
  id: string;
  elementId: string;
  effect: AnimationEffect;
  trigger: AnimationTrigger;
  durationMs: number;
  delayMs: number;
};

export const ENTRANCE_EFFECTS: AnimationEffect[] = [
  'fade-in', 'fly-in-left', 'fly-in-right', 'fly-in-top', 'fly-in-bottom',
  'zoom-in', 'wipe-right',
];

export const EXIT_EFFECTS: AnimationEffect[] = [
  'fade-out', 'fly-out-left', 'fly-out-right', 'zoom-out',
];

export const EMPHASIS_EFFECTS: AnimationEffect[] = ['pulse', 'spin'];

export const ALL_EFFECTS: AnimationEffect[] = [
  ...ENTRANCE_EFFECTS, ...EXIT_EFFECTS, ...EMPHASIS_EFFECTS,
];

export const TRIGGER_TYPES: AnimationTrigger[] = ['on-click', 'with-previous', 'after-previous'];

export const EFFECT_LABELS: Record<AnimationEffect, string> = {
  'fade-in': 'Fade In',
  'fly-in-left': 'Fly In From Left',
  'fly-in-right': 'Fly In From Right',
  'fly-in-top': 'Fly In From Top',
  'fly-in-bottom': 'Fly In From Bottom',
  'zoom-in': 'Zoom In',
  'wipe-right': 'Wipe Right',
  'fade-out': 'Fade Out',
  'fly-out-left': 'Fly Out To Left',
  'fly-out-right': 'Fly Out To Right',
  'zoom-out': 'Zoom Out',
  'pulse': 'Pulse',
  'spin': 'Spin',
};

export const TRIGGER_LABELS: Record<AnimationTrigger, string> = {
  'on-click': 'On Click',
  'with-previous': 'With Previous',
  'after-previous': 'After Previous',
};

export const DEFAULT_DURATION_MS = 500;
export const DEFAULT_DELAY_MS = 0;
export const MIN_DURATION_MS = 100;
export const MAX_DURATION_MS = 10_000;

export function categoryOf(effect: AnimationEffect): AnimationCategory {
  if (ENTRANCE_EFFECTS.includes(effect)) return 'entrance';
  if (EXIT_EFFECTS.includes(effect)) return 'exit';
  return 'emphasis';
}

export function isAnimationEffect(value: unknown): value is AnimationEffect {
  return typeof value === 'string' && (ALL_EFFECTS as string[]).includes(value);
}

export function isAnimationTrigger(value: unknown): value is AnimationTrigger {
  return typeof value === 'string' && (TRIGGER_TYPES as string[]).includes(value);
}

/**
 * An "animation step" is a unit of playback advancement. Pressing the next
 * key in presenter mode plays the next step. Animations triggered "with-
 * previous" or "after-previous" run inside the same step as the click that
 * began it. The first on-click animation on a slide opens step 1.
 */
export type AnimationStep = {
  /** Absolute index within the slide (1-based for human display, 0-based here). */
  index: number;
  /** Animations to dispatch. Order is significant for after-previous chaining. */
  items: ElementAnimation[];
};
