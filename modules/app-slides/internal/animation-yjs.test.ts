/** Contract: contracts/app-slides/rules.md */

import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import {
  appendAnimation, listAnimations, updateAnimationField, removeAnimation,
  moveAnimation, pruneAnimationsForMissingElements, buildAnimationSteps,
  parseAnimation, getYAnimations,
} from './animation-yjs.ts';
import { MIN_DURATION_MS, MAX_DURATION_MS } from './animation-types.ts';

function makeSlide(): { ydoc: Y.Doc; slide: Y.Map<unknown> } {
  const ydoc = new Y.Doc();
  const yslides = ydoc.getArray<Y.Map<unknown>>('slides');
  const slide = new Y.Map<unknown>();
  ydoc.transact(() => yslides.push([slide]));
  return { ydoc, slide };
}

describe('appendAnimation', () => {
  it('creates an animations array on first append and stores fields', () => {
    const { ydoc, slide } = makeSlide();
    expect(getYAnimations(slide)).toBeNull();
    const anim = appendAnimation(ydoc, slide, { elementId: 'el-1', effect: 'fade-in' });
    expect(anim.id).toBeTruthy();
    expect(anim.effect).toBe('fade-in');
    expect(anim.trigger).toBe('on-click');
    const list = listAnimations(slide);
    expect(list).toHaveLength(1);
    expect(list[0].elementId).toBe('el-1');
  });

  it('preserves insertion order across multiple appends', () => {
    const { ydoc, slide } = makeSlide();
    appendAnimation(ydoc, slide, { elementId: 'a', effect: 'fade-in' });
    appendAnimation(ydoc, slide, { elementId: 'b', effect: 'zoom-in' });
    appendAnimation(ydoc, slide, { elementId: 'c', effect: 'fly-in-left' });
    expect(listAnimations(slide).map((a) => a.elementId)).toEqual(['a', 'b', 'c']);
  });

  it('clamps duration into [MIN_DURATION_MS, MAX_DURATION_MS]', () => {
    const { ydoc, slide } = makeSlide();
    const a = appendAnimation(ydoc, slide, { elementId: 'x', effect: 'fade-in', durationMs: 50 });
    const b = appendAnimation(ydoc, slide, { elementId: 'y', effect: 'fade-in', durationMs: 999_999 });
    expect(a.durationMs).toBe(MIN_DURATION_MS);
    expect(b.durationMs).toBe(MAX_DURATION_MS);
  });

  it('clamps negative delay to 0', () => {
    const { ydoc, slide } = makeSlide();
    const a = appendAnimation(ydoc, slide, { elementId: 'x', effect: 'fade-in', delayMs: -200 });
    expect(a.delayMs).toBe(0);
  });
});

describe('updateAnimationField', () => {
  it('updates effect, trigger, duration and delay', () => {
    const { ydoc, slide } = makeSlide();
    const anim = appendAnimation(ydoc, slide, { elementId: 'x', effect: 'fade-in' });
    updateAnimationField(ydoc, slide, anim.id, 'effect', 'zoom-in');
    updateAnimationField(ydoc, slide, anim.id, 'trigger', 'with-previous');
    updateAnimationField(ydoc, slide, anim.id, 'durationMs', 1234);
    updateAnimationField(ydoc, slide, anim.id, 'delayMs', 100);
    const updated = listAnimations(slide)[0];
    expect(updated.effect).toBe('zoom-in');
    expect(updated.trigger).toBe('with-previous');
    expect(updated.durationMs).toBe(1234);
    expect(updated.delayMs).toBe(100);
  });

  it('rejects invalid effect names', () => {
    const { ydoc, slide } = makeSlide();
    const anim = appendAnimation(ydoc, slide, { elementId: 'x', effect: 'fade-in' });
    updateAnimationField(ydoc, slide, anim.id, 'effect', 'not-real');
    expect(listAnimations(slide)[0].effect).toBe('fade-in');
  });
});

describe('removeAnimation', () => {
  it('removes the animation by id', () => {
    const { ydoc, slide } = makeSlide();
    const a = appendAnimation(ydoc, slide, { elementId: 'x', effect: 'fade-in' });
    const b = appendAnimation(ydoc, slide, { elementId: 'y', effect: 'fade-in' });
    removeAnimation(ydoc, slide, a.id);
    const list = listAnimations(slide);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(b.id);
  });
});

describe('moveAnimation', () => {
  it('reorders animations to the requested index', () => {
    const { ydoc, slide } = makeSlide();
    appendAnimation(ydoc, slide, { elementId: 'a', effect: 'fade-in' });
    appendAnimation(ydoc, slide, { elementId: 'b', effect: 'fade-in' });
    appendAnimation(ydoc, slide, { elementId: 'c', effect: 'fade-in' });
    moveAnimation(ydoc, slide, 0, 2);
    expect(listAnimations(slide).map((a) => a.elementId)).toEqual(['b', 'c', 'a']);
  });

  it('is a no-op for invalid indices', () => {
    const { ydoc, slide } = makeSlide();
    appendAnimation(ydoc, slide, { elementId: 'a', effect: 'fade-in' });
    moveAnimation(ydoc, slide, 0, 5);
    moveAnimation(ydoc, slide, -1, 0);
    expect(listAnimations(slide)).toHaveLength(1);
  });
});

describe('pruneAnimationsForMissingElements', () => {
  it('removes rows whose elementId is no longer present', () => {
    const { ydoc, slide } = makeSlide();
    appendAnimation(ydoc, slide, { elementId: 'keep', effect: 'fade-in' });
    appendAnimation(ydoc, slide, { elementId: 'gone', effect: 'fade-in' });
    appendAnimation(ydoc, slide, { elementId: 'keep', effect: 'zoom-in' });
    pruneAnimationsForMissingElements(ydoc, slide, new Set(['keep']));
    const list = listAnimations(slide);
    expect(list).toHaveLength(2);
    expect(list.every((a) => a.elementId === 'keep')).toBe(true);
  });

  it('does nothing when all element ids are valid', () => {
    const { ydoc, slide } = makeSlide();
    appendAnimation(ydoc, slide, { elementId: 'a', effect: 'fade-in' });
    pruneAnimationsForMissingElements(ydoc, slide, new Set(['a', 'b']));
    expect(listAnimations(slide)).toHaveLength(1);
  });
});

describe('parseAnimation', () => {
  it('returns null for malformed rows', () => {
    const ydoc = new Y.Doc();
    const yarr = ydoc.getArray<Y.Map<unknown>>('rows');
    const row = new Y.Map<unknown>();
    ydoc.transact(() => {
      yarr.push([row]);
      row.set('id', 'x');
      row.set('elementId', 'y');
      row.set('effect', 'not-real');
      row.set('trigger', 'on-click');
    });
    expect(parseAnimation(row)).toBeNull();
  });
});

describe('buildAnimationSteps', () => {
  it('groups with-previous and after-previous into the same step', () => {
    const steps = buildAnimationSteps([
      { id: '1', elementId: 'a', effect: 'fade-in', trigger: 'on-click', durationMs: 500, delayMs: 0 },
      { id: '2', elementId: 'b', effect: 'fade-in', trigger: 'with-previous', durationMs: 500, delayMs: 0 },
      { id: '3', elementId: 'c', effect: 'fade-in', trigger: 'after-previous', durationMs: 500, delayMs: 0 },
    ]);
    expect(steps).toHaveLength(1);
    expect(steps[0].items.map((i) => i.id)).toEqual(['1', '2', '3']);
  });

  it('opens a new step on each on-click trigger', () => {
    const steps = buildAnimationSteps([
      { id: '1', elementId: 'a', effect: 'fade-in', trigger: 'on-click', durationMs: 500, delayMs: 0 },
      { id: '2', elementId: 'b', effect: 'fade-in', trigger: 'on-click', durationMs: 500, delayMs: 0 },
      { id: '3', elementId: 'c', effect: 'fade-in', trigger: 'with-previous', durationMs: 500, delayMs: 0 },
    ]);
    expect(steps).toHaveLength(2);
    expect(steps[0].items.map((i) => i.id)).toEqual(['1']);
    expect(steps[1].items.map((i) => i.id)).toEqual(['2', '3']);
  });

  it('treats a leading non-on-click trigger as the first step', () => {
    const steps = buildAnimationSteps([
      { id: '1', elementId: 'a', effect: 'fade-in', trigger: 'with-previous', durationMs: 500, delayMs: 0 },
    ]);
    expect(steps).toHaveLength(1);
    expect(steps[0].items[0].id).toBe('1');
  });

  it('returns an empty array for no animations', () => {
    expect(buildAnimationSteps([])).toEqual([]);
  });
});
