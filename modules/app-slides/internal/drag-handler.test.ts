/** Contract: contracts/app-slides/rules.md */

import { describe, it, expect } from 'vitest';
import { startDrag, updateDrag, nudgeElements } from './drag-handler.ts';
import type { SlideElement } from './types.ts';

function el(id: string, x: number, y: number, w = 10, h = 10): SlideElement {
  return { id, type: 'shape', x, y, width: w, height: h, rotation: 0, content: '' };
}

describe('startDrag', () => {
  it('captures initial positions of selected elements', () => {
    const elements = [el('a', 10, 20), el('b', 30, 40)];
    const state = startDrag(elements, ['a'], { x: 15, y: 25 });
    expect(state.elementIds).toEqual(['a']);
    expect(state.startPositions.get('a')).toEqual({ x: 10, y: 20 });
    expect(state.startPositions.has('b')).toBe(false);
  });
});

describe('updateDrag', () => {
  it('moves element by mouse delta', () => {
    const elements = [el('a', 10, 20), el('b', 50, 50)];
    const state = startDrag(elements, ['a'], { x: 15, y: 25 });
    // Use large grid to avoid grid snapping interference
    const result = updateDrag(state, { x: 25, y: 35 }, elements);
    const pos = result.updates.get('a');
    expect(pos).toBeDefined();
    // Delta is +10, +10; exact position depends on snap but should be close
    expect(pos!.x).toBeGreaterThan(15);
    expect(pos!.y).toBeGreaterThan(25);
  });

  it('moves multiple selected elements together', () => {
    const elements = [el('a', 10, 20), el('b', 30, 40)];
    const state = startDrag(elements, ['a', 'b'], { x: 15, y: 25 });
    const result = updateDrag(state, { x: 20, y: 30 }, elements);
    expect(result.updates.has('a')).toBe(true);
    expect(result.updates.has('b')).toBe(true);
  });
});

describe('nudgeElements', () => {
  it('nudges right by given amount', () => {
    const elements = [el('a', 10, 20)];
    const updates = nudgeElements(elements, ['a'], 'right', 1);
    expect(updates.get('a')).toEqual({ x: 11, y: 20 });
  });

  it('nudges left by given amount', () => {
    const elements = [el('a', 10, 20)];
    const updates = nudgeElements(elements, ['a'], 'left', 1);
    expect(updates.get('a')).toEqual({ x: 9, y: 20 });
  });

  it('nudges up by given amount', () => {
    const elements = [el('a', 10, 20)];
    const updates = nudgeElements(elements, ['a'], 'up', 5);
    expect(updates.get('a')).toEqual({ x: 10, y: 15 });
  });

  it('nudges down by given amount', () => {
    const elements = [el('a', 10, 20)];
    const updates = nudgeElements(elements, ['a'], 'down', 10);
    expect(updates.get('a')).toEqual({ x: 10, y: 30 });
  });

  it('clamps to 0-100 range', () => {
    const elements = [el('a', 1, 1)];
    const updates = nudgeElements(elements, ['a'], 'left', 5);
    expect(updates.get('a')!.x).toBe(0);
  });

  it('clamps upper bound', () => {
    const elements = [el('a', 99, 99)];
    const updates = nudgeElements(elements, ['a'], 'right', 5);
    expect(updates.get('a')!.x).toBe(100);
  });

  it('only nudges selected elements', () => {
    const elements = [el('a', 10, 20), el('b', 30, 40)];
    const updates = nudgeElements(elements, ['a'], 'right', 1);
    expect(updates.has('a')).toBe(true);
    expect(updates.has('b')).toBe(false);
  });
});
