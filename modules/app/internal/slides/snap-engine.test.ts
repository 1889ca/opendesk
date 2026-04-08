/** Contract: contracts/app/slides-interaction.md */

import { describe, it, expect } from 'vitest';
import { snapToGrid, calculateSnap } from './snap-engine.ts';
import type { SlideElement } from './types.ts';

function makeElement(overrides: Partial<SlideElement> & { id: string }): SlideElement {
  return {
    type: 'shape', x: 0, y: 0, width: 20, height: 15, rotation: 0, content: '',
    ...overrides,
  };
}

describe('snapToGrid', () => {
  it('snaps value to nearest grid line', () => {
    expect(snapToGrid(12, 5)).toBe(10);
    expect(snapToGrid(13, 5)).toBe(15);
    expect(snapToGrid(0, 5)).toBe(0);
    expect(snapToGrid(100, 5)).toBe(100);
  });

  it('snaps exactly on grid lines', () => {
    expect(snapToGrid(25, 5)).toBe(25);
    expect(snapToGrid(50, 10)).toBe(50);
  });

  it('handles non-standard grid sizes', () => {
    expect(snapToGrid(7, 3)).toBe(6);
    expect(snapToGrid(8, 3)).toBe(9);
  });
});

describe('calculateSnap', () => {
  it('snaps to canvas center guides', () => {
    const movingBox = { x: 49.5, y: 49.5, width: 20, height: 15 };
    const result = calculateSnap(movingBox, [], [], 100);
    // Should snap to 50 center guide
    expect(result.guides.length).toBeGreaterThan(0);
  });

  it('snaps to another element edge', () => {
    const otherEl = makeElement({ id: 'other', x: 30, y: 10, width: 20, height: 15 });
    // Place moving box so its left edge (x=49.5) is close to other's right edge (30+20=50)
    const movingBox = { x: 49.5, y: 40, width: 20, height: 15 };
    const result = calculateSnap(movingBox, [otherEl], [], 100);
    expect(result.snappedX).toBeCloseTo(50, 1);
    expect(result.guides.some((g) => g.axis === 'vertical')).toBe(true);
  });

  it('excludes dragged elements from snap targets', () => {
    const self = makeElement({ id: 'self', x: 10, y: 10 });
    const other = makeElement({ id: 'other', x: 60, y: 60 });
    const movingBox = { x: 10.5, y: 10.5, width: 20, height: 15 };
    const result = calculateSnap(movingBox, [self, other], ['self'], 100);
    // Should not snap to self's edges
    const vGuides = result.guides.filter((g) => g.axis === 'vertical');
    for (const g of vGuides) {
      expect(g.position).not.toBe(10); // self's x
    }
  });

  it('returns empty guides when nothing is near', () => {
    const movingBox = { x: 33, y: 33, width: 10, height: 10 };
    const result = calculateSnap(movingBox, [], [], 100); // large grid = no grid snap
    expect(result.snappedX).toBeCloseTo(33, 0);
    expect(result.snappedY).toBeCloseTo(33, 0);
  });

  it('snaps to canvas edge (0)', () => {
    const movingBox = { x: 0.5, y: 0.5, width: 20, height: 15 };
    const result = calculateSnap(movingBox, [], [], 100);
    expect(result.snappedX).toBeCloseTo(0, 0);
    expect(result.snappedY).toBeCloseTo(0, 0);
  });
});
