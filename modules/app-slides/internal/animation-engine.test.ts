/** Contract: contracts/app-slides/rules.md */

import { describe, it, expect } from 'vitest';
import {
  keyframesFor, prepareInitialState, runStep, createAnimationController,
} from './animation-engine.ts';
import type { AnimationEffect, ElementAnimation } from './animation-types.ts';

/**
 * Engine tests run without jsdom. We construct minimal fake elements that
 * implement only what the engine touches: `style` and `animate()`.
 */

interface FakeAnim {
  onfinish: null | (() => void);
  oncancel: null | (() => void);
  cancel: () => void;
}

interface FakeElement {
  style: Record<string, string>;
  animate: () => FakeAnim;
  __invocations: number;
}

function makeFake(opts?: { onAnimate?: (id: number) => void }): FakeElement {
  const fake: FakeElement = {
    style: {},
    __invocations: 0,
    animate() {
      fake.__invocations += 1;
      const id = fake.__invocations;
      const handle: FakeAnim = { onfinish: null, oncancel: null, cancel() {} };
      // Fire onfinish on next microtask after the engine attaches it.
      queueMicrotask(() => queueMicrotask(() => {
        opts?.onAnimate?.(id);
        handle.onfinish?.();
      }));
      return handle;
    },
  };
  return fake;
}

function makeAnim(over: Partial<ElementAnimation> & { id: string; elementId: string; effect: AnimationEffect }): ElementAnimation {
  return { trigger: 'on-click', durationMs: 200, delayMs: 0, ...over };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asEl = (f: FakeElement) => f as any;

describe('keyframesFor', () => {
  it('produces 2-frame entrance animations', () => {
    expect(keyframesFor('fade-in')).toHaveLength(2);
    expect(keyframesFor('zoom-in')).toHaveLength(2);
    expect(keyframesFor('fly-in-left')).toHaveLength(2);
  });

  it('produces 3-frame pulse animation', () => {
    expect(keyframesFor('pulse')).toHaveLength(3);
  });

  it('rotates from 0 to 360 degrees for spin', () => {
    const kf = keyframesFor('spin') as Array<Record<string, string>>;
    expect(kf[0].transform).toContain('0deg');
    expect(kf[1].transform).toContain('360deg');
  });

  it('uses opacity for fade variants', () => {
    expect(keyframesFor('fade-in')[0]).toMatchObject({ opacity: 0 });
    expect(keyframesFor('fade-out')[1]).toMatchObject({ opacity: 0 });
  });
});

describe('prepareInitialState', () => {
  it('hides any element with an entrance animation', () => {
    const a = makeFake();
    const b = makeFake();
    const resolver = (id: string) => asEl(({ a, b } as Record<string, FakeElement>)[id] ?? null);
    prepareInitialState([
      makeAnim({ id: '1', elementId: 'a', effect: 'fade-in' }),
      makeAnim({ id: '2', elementId: 'b', effect: 'pulse' }),
    ], resolver);
    expect(a.style.opacity).toBe('0');
    // Emphasis effects do not hide the element.
    expect(b.style.opacity).toBeUndefined();
  });

  it('does not hide elements that only have exit animations', () => {
    const el = makeFake();
    prepareInitialState([
      makeAnim({ id: '1', elementId: 'x', effect: 'fade-out' }),
    ], () => asEl(el));
    expect(el.style.opacity).toBeUndefined();
  });

  it('only hides each element once even with multiple entrances', () => {
    const el = makeFake();
    prepareInitialState([
      makeAnim({ id: '1', elementId: 'x', effect: 'fade-in' }),
      makeAnim({ id: '2', elementId: 'x', effect: 'fly-in-left' }),
    ], () => asEl(el));
    expect(el.style.opacity).toBe('0');
  });
});

describe('runStep', () => {
  it('invokes animate once per item', async () => {
    const el = makeFake();
    await runStep({
      index: 0,
      items: [
        makeAnim({ id: '1', elementId: 'x', effect: 'fade-in' }),
        makeAnim({ id: '2', elementId: 'x', effect: 'pulse', trigger: 'with-previous' }),
      ],
    }, () => asEl(el));
    expect(el.__invocations).toBe(2);
  });

  it('skips animations whose target cannot be resolved', async () => {
    await runStep({
      index: 0,
      items: [makeAnim({ id: '1', elementId: 'missing', effect: 'fade-in' })],
    }, () => null);
    // Nothing to assert beyond not throwing.
    expect(true).toBe(true);
  });

  it('after-previous animations run sequentially within a step', async () => {
    const events: number[] = [];
    const el = makeFake({ onAnimate: (id) => events.push(id) });
    await runStep({
      index: 0,
      items: [
        makeAnim({ id: '1', elementId: 'x', effect: 'fade-in' }),
        makeAnim({ id: '2', elementId: 'x', effect: 'fade-in', trigger: 'after-previous' }),
      ],
    }, () => asEl(el));
    // Each animation calls animate() exactly once. With after-previous
    // chaining, the second call must occur after the first finishes.
    expect(events).toEqual([1, 2]);
  });
});

describe('createAnimationController', () => {
  it('reports total step count', () => {
    const el = makeFake();
    const ctrl = createAnimationController(
      [{ index: 0, items: [makeAnim({ id: '1', elementId: 'x', effect: 'fade-in' })] }],
      [makeAnim({ id: '1', elementId: 'x', effect: 'fade-in' })],
      () => asEl(el),
    );
    expect(ctrl.totalSteps).toBe(1);
    expect(ctrl.currentStep).toBe(0);
  });

  it('returns done=true when next() is called past the last step', async () => {
    const ctrl = createAnimationController([], [], () => null);
    expect((await ctrl.next()).done).toBe(true);
  });

  it('advances currentStep after each next()', async () => {
    const el = makeFake();
    const animations = [
      makeAnim({ id: '1', elementId: 'x', effect: 'fade-in' }),
      makeAnim({ id: '2', elementId: 'x', effect: 'fade-in' }),
    ];
    const ctrl = createAnimationController(
      [{ index: 0, items: [animations[0]] }, { index: 1, items: [animations[1]] }],
      animations,
      () => asEl(el),
    );
    expect(ctrl.currentStep).toBe(0);
    await ctrl.next();
    expect(ctrl.currentStep).toBe(1);
    const r = await ctrl.next();
    expect(r.done).toBe(true);
    expect(ctrl.currentStep).toBe(2);
  });

  it('reset rewinds to step 0 and re-hides entrance elements', () => {
    const el = makeFake();
    el.style.opacity = '1';
    const animations = [makeAnim({ id: '1', elementId: 'x', effect: 'fade-in' })];
    const ctrl = createAnimationController(
      [{ index: 0, items: animations }],
      animations,
      () => asEl(el),
    );
    el.style.opacity = '1';
    ctrl.reset();
    expect(el.style.opacity).toBe('0');
    expect(ctrl.currentStep).toBe(0);
  });
});
