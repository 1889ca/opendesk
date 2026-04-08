/** Contract: contracts/app-slides/rules.md */

import { describe, it, expect } from 'vitest';
import { startResize, updateResize } from './resize-handler.ts';
import { MIN_ELEMENT_WIDTH, MIN_ELEMENT_HEIGHT } from './types.ts';

describe('resize: bottom-right handle', () => {
  it('increases size when dragging outward', () => {
    const state = startResize({ x: 10, y: 10, width: 20, height: 15 }, 'bottom-right', { x: 30, y: 25 }, false);
    const result = updateResize(state, { x: 40, y: 35 }, false);
    expect(result.bounds.width).toBeCloseTo(30, 1);
    expect(result.bounds.height).toBeCloseTo(25, 1);
    expect(result.bounds.x).toBeCloseTo(10, 1); // origin unchanged
    expect(result.bounds.y).toBeCloseTo(10, 1);
  });

  it('enforces minimum size', () => {
    const state = startResize({ x: 10, y: 10, width: 20, height: 15 }, 'bottom-right', { x: 30, y: 25 }, false);
    // Drag far inward
    const result = updateResize(state, { x: 5, y: 5 }, false);
    expect(result.bounds.width).toBe(MIN_ELEMENT_WIDTH);
    expect(result.bounds.height).toBe(MIN_ELEMENT_HEIGHT);
  });
});

describe('resize: top-left handle', () => {
  it('moves origin and adjusts size', () => {
    const state = startResize({ x: 20, y: 20, width: 30, height: 25 }, 'top-left', { x: 20, y: 20 }, false);
    const result = updateResize(state, { x: 15, y: 15 }, false);
    expect(result.bounds.x).toBeCloseTo(15, 1);
    expect(result.bounds.y).toBeCloseTo(15, 1);
    expect(result.bounds.width).toBeCloseTo(35, 1);
    expect(result.bounds.height).toBeCloseTo(30, 1);
  });
});

describe('resize: edge handles', () => {
  it('right handle changes width only', () => {
    const state = startResize({ x: 10, y: 10, width: 20, height: 15 }, 'right', { x: 30, y: 17.5 }, false);
    const result = updateResize(state, { x: 40, y: 17.5 }, false);
    expect(result.bounds.width).toBeCloseTo(30, 1);
    expect(result.bounds.height).toBeCloseTo(15, 1);
    expect(result.bounds.x).toBeCloseTo(10, 1);
  });

  it('bottom handle changes height only', () => {
    const state = startResize({ x: 10, y: 10, width: 20, height: 15 }, 'bottom', { x: 20, y: 25 }, false);
    const result = updateResize(state, { x: 20, y: 35 }, false);
    expect(result.bounds.height).toBeCloseTo(25, 1);
    expect(result.bounds.width).toBeCloseTo(20, 1);
  });
});

describe('resize: aspect ratio lock', () => {
  it('maintains aspect ratio when Shift is held', () => {
    // 20:15 = 4:3 ratio
    const state = startResize({ x: 10, y: 10, width: 20, height: 15 }, 'bottom-right', { x: 30, y: 25 }, true);
    const result = updateResize(state, { x: 40, y: 25 }, true);
    const ratio = result.bounds.width / result.bounds.height;
    expect(ratio).toBeCloseTo(20 / 15, 1);
  });
});
