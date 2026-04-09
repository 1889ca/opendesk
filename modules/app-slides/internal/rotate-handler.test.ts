/** Contract: contracts/app-slides/rules.md */

import { describe, it, expect } from 'vitest';
import {
  angleFromCenter, startRotate, updateRotate, snapRotation,
  normalizeAngle, getElementCenter,
} from './rotate-handler.ts';

describe('angleFromCenter', () => {
  const center = { x: 50, y: 50 };

  it('returns 0 for directly above', () => {
    expect(angleFromCenter(center, { x: 50, y: 30 })).toBeCloseTo(0, 1);
  });

  it('returns 90 for directly right', () => {
    expect(angleFromCenter(center, { x: 70, y: 50 })).toBeCloseTo(90, 1);
  });

  it('returns 180 for directly below', () => {
    expect(angleFromCenter(center, { x: 50, y: 70 })).toBeCloseTo(180, 1);
  });

  it('returns 270 for directly left', () => {
    expect(angleFromCenter(center, { x: 30, y: 50 })).toBeCloseTo(270, 1);
  });

  it('returns 45 for upper-right diagonal', () => {
    expect(angleFromCenter(center, { x: 60, y: 40 })).toBeCloseTo(45, 1);
  });
});

describe('normalizeAngle', () => {
  it('keeps values in 0-360 range', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(450)).toBe(90);
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(-360)).toBe(0);
  });
});

describe('snapRotation', () => {
  it('snaps to nearest 15-degree increment', () => {
    expect(snapRotation(7)).toBe(0);
    expect(snapRotation(8)).toBe(15);
    expect(snapRotation(22)).toBe(15);
    expect(snapRotation(23)).toBe(30);
    expect(snapRotation(90)).toBe(90);
    expect(snapRotation(352)).toBe(345);
    expect(snapRotation(353)).toBe(360);
  });
});

describe('getElementCenter', () => {
  it('calculates center of element bounds', () => {
    const center = getElementCenter(10, 20, 30, 40);
    expect(center).toEqual({ x: 25, y: 40 });
  });
});

describe('startRotate / updateRotate', () => {
  it('calculates rotation delta from initial mouse position', () => {
    const center = { x: 50, y: 50 };
    // Mouse starts directly above center (0 degrees)
    const state = startRotate(center, { x: 50, y: 30 }, 0);
    // Mouse moves to right (90 degrees) — delta should be +90
    const angle = updateRotate(state, { x: 70, y: 50 });
    expect(angle).toBeCloseTo(90, 0);
  });

  it('preserves existing rotation', () => {
    const center = { x: 50, y: 50 };
    const state = startRotate(center, { x: 50, y: 30 }, 45);
    // Mouse moves 90 degrees clockwise: 45 + 90 = 135
    const angle = updateRotate(state, { x: 70, y: 50 });
    expect(angle).toBeCloseTo(135, 0);
  });
});
