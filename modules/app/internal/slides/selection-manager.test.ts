/** Contract: contracts/app/slides-interaction.md */

import { describe, it, expect } from 'vitest';
import {
  createSelectionState, selectSingle, selectToggle, selectNone,
  selectByMarquee, normalizeRect, boxesIntersect, pointInBox, elementAtPoint,
} from './selection-manager.ts';
import type { SlideElement } from './types.ts';

function el(id: string, x: number, y: number, w = 10, h = 10): SlideElement {
  return { id, type: 'shape', x, y, width: w, height: h, rotation: 0, content: '' };
}

describe('selection operations', () => {
  it('creates empty selection', () => {
    const s = createSelectionState();
    expect(s.selectedIds.size).toBe(0);
  });

  it('selectSingle replaces current selection', () => {
    let s = selectSingle(createSelectionState(), 'a');
    expect(s.selectedIds.has('a')).toBe(true);
    s = selectSingle(s, 'b');
    expect(s.selectedIds.has('a')).toBe(false);
    expect(s.selectedIds.has('b')).toBe(true);
  });

  it('selectToggle adds and removes elements', () => {
    let s = createSelectionState();
    s = selectToggle(s, 'a');
    expect(s.selectedIds.has('a')).toBe(true);
    s = selectToggle(s, 'b');
    expect(s.selectedIds.size).toBe(2);
    s = selectToggle(s, 'a');
    expect(s.selectedIds.has('a')).toBe(false);
    expect(s.selectedIds.has('b')).toBe(true);
  });

  it('selectNone clears all', () => {
    const s = selectNone();
    expect(s.selectedIds.size).toBe(0);
  });
});

describe('normalizeRect', () => {
  it('normalizes when b is below-right of a', () => {
    const r = normalizeRect({ x: 10, y: 10 }, { x: 30, y: 40 });
    expect(r).toEqual({ x: 10, y: 10, width: 20, height: 30 });
  });

  it('normalizes when a is below-right of b', () => {
    const r = normalizeRect({ x: 30, y: 40 }, { x: 10, y: 10 });
    expect(r).toEqual({ x: 10, y: 10, width: 20, height: 30 });
  });
});

describe('boxesIntersect', () => {
  it('returns true for overlapping boxes', () => {
    expect(boxesIntersect(
      { x: 0, y: 0, width: 20, height: 20 },
      { x: 10, y: 10, width: 20, height: 20 },
    )).toBe(true);
  });

  it('returns false for non-overlapping boxes', () => {
    expect(boxesIntersect(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 20, y: 20, width: 10, height: 10 },
    )).toBe(false);
  });

  it('returns false for adjacent (touching) boxes', () => {
    expect(boxesIntersect(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 10, y: 0, width: 10, height: 10 },
    )).toBe(false);
  });
});

describe('pointInBox', () => {
  it('returns true for point inside', () => {
    expect(pointInBox({ x: 5, y: 5 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(true);
  });

  it('returns true for point on edge', () => {
    expect(pointInBox({ x: 0, y: 0 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(true);
  });

  it('returns false for point outside', () => {
    expect(pointInBox({ x: 15, y: 5 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(false);
  });
});

describe('elementAtPoint', () => {
  const elements = [el('a', 0, 0), el('b', 5, 5), el('c', 50, 50)];

  it('returns topmost element at point', () => {
    const hit = elementAtPoint(elements, { x: 7, y: 7 });
    expect(hit?.id).toBe('b'); // b is later in array (topmost) and overlaps with a
  });

  it('returns null for empty area', () => {
    const hit = elementAtPoint(elements, { x: 90, y: 90 });
    expect(hit).toBe(null);
  });
});

describe('selectByMarquee', () => {
  const elements = [el('a', 10, 10), el('b', 30, 30), el('c', 70, 70)];

  it('selects elements intersecting the marquee', () => {
    const s = selectByMarquee(elements, { x: 0, y: 0 }, { x: 25, y: 25 });
    expect(s.selectedIds.has('a')).toBe(true);
    expect(s.selectedIds.has('b')).toBe(false);
    expect(s.selectedIds.has('c')).toBe(false);
  });

  it('selects multiple elements', () => {
    const s = selectByMarquee(elements, { x: 0, y: 0 }, { x: 45, y: 45 });
    expect(s.selectedIds.has('a')).toBe(true);
    expect(s.selectedIds.has('b')).toBe(true);
  });

  it('handles reversed marquee direction', () => {
    const s = selectByMarquee(elements, { x: 25, y: 25 }, { x: 0, y: 0 });
    expect(s.selectedIds.has('a')).toBe(true);
  });
});
