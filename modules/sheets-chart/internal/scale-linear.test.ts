/** Contract: contracts/sheets-chart/rules.md */
import { describe, it, expect } from 'vitest';
import { createLinearScale } from './scale-linear.ts';

describe('createLinearScale', () => {
  it('creates a scale with nice tick values', () => {
    const scale = createLinearScale({
      values: [10, 50, 30, 90],
      rangeStart: 0,
      rangeEnd: 400,
    });

    expect(scale.min).toBeLessThanOrEqual(0);
    expect(scale.max).toBeGreaterThanOrEqual(90);
    expect(scale.ticks.length).toBeGreaterThan(0);
  });

  it('forces zero in range when all values are positive', () => {
    const scale = createLinearScale({
      values: [10, 20, 30],
      rangeStart: 0,
      rangeEnd: 300,
      forceZero: true,
    });

    expect(scale.min).toBe(0);
  });

  it('handles equal values by expanding range', () => {
    const scale = createLinearScale({
      values: [5, 5, 5],
      rangeStart: 0,
      rangeEnd: 200,
    });

    expect(scale.min).not.toBe(scale.max);
    expect(scale.ticks.length).toBeGreaterThan(0);
  });

  it('handles empty values', () => {
    const scale = createLinearScale({
      values: [],
      rangeStart: 0,
      rangeEnd: 400,
    });

    expect(scale.min).toBe(0);
    expect(scale.max).toBe(1);
    expect(scale.ticks.length).toBe(2);
  });

  it('scales values correctly', () => {
    const scale = createLinearScale({
      values: [0, 100],
      rangeStart: 0,
      rangeEnd: 400,
    });

    expect(scale.scale(0)).toBe(0);
    expect(scale.scale(scale.max)).toBe(400);
  });

  it('handles negative values', () => {
    const scale = createLinearScale({
      values: [-50, -10, 30, 70],
      rangeStart: 0,
      rangeEnd: 400,
    });

    expect(scale.min).toBeLessThanOrEqual(-50);
    expect(scale.max).toBeGreaterThanOrEqual(70);
  });

  it('produces formatted tick labels', () => {
    const scale = createLinearScale({
      values: [0, 5000],
      rangeStart: 0,
      rangeEnd: 400,
    });

    const labels = scale.ticks.map((t) => t.label);
    expect(labels.some((l) => l.includes('K'))).toBe(true);
  });

  it('respects custom tick count', () => {
    const scale = createLinearScale({
      values: [0, 100],
      rangeStart: 0,
      rangeEnd: 400,
      tickCount: 3,
    });

    expect(scale.ticks.length).toBeGreaterThanOrEqual(2);
    expect(scale.ticks.length).toBeLessThanOrEqual(6);
  });
});
