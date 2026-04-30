/** Contract: contracts/sheets-chart/rules.md */
import { describe, it, expect } from 'vitest';
import { computeSlices } from './render-pie.ts';

describe('computeSlices', () => {
  it('computes correct percentages', () => {
    const slices = computeSlices(
      ['A', 'B', 'C'],
      [50, 30, 20],
    );
    expect(slices).toHaveLength(3);
    expect(slices[0].percentage).toBe(50);
    expect(slices[1].percentage).toBe(30);
    expect(slices[2].percentage).toBe(20);
  });

  it('angles sum to 2*PI', () => {
    const slices = computeSlices(
      ['A', 'B', 'C', 'D'],
      [25, 35, 15, 25],
    );
    const totalAngle = slices.reduce(
      (sum, s) => sum + (s.endAngle - s.startAngle),
      0,
    );
    expect(totalAngle).toBeCloseTo(Math.PI * 2, 10);
  });

  it('treats negative values as zero', () => {
    const slices = computeSlices(
      ['A', 'B', 'C'],
      [100, -20, 50],
    );
    const bSlice = slices.find((s) => s.label === 'B');
    expect(bSlice?.value).toBe(0);
    expect(bSlice?.percentage).toBe(0);
  });

  it('returns empty for all-zero values', () => {
    const slices = computeSlices(['A', 'B'], [0, 0]);
    expect(slices).toHaveLength(0);
  });

  it('handles single value', () => {
    const slices = computeSlices(['Only'], [100]);
    expect(slices).toHaveLength(1);
    expect(slices[0].percentage).toBe(100);
    const angle = slices[0].endAngle - slices[0].startAngle;
    expect(angle).toBeCloseTo(Math.PI * 2, 10);
  });

  it('assigns deterministic colors', () => {
    const s1 = computeSlices(['A', 'B'], [50, 50]);
    const s2 = computeSlices(['A', 'B'], [50, 50]);
    expect(s1[0].color).toBe(s2[0].color);
    expect(s1[1].color).toBe(s2[1].color);
    expect(s1[0].color).not.toBe(s1[1].color);
  });

  it('starts at -PI/2 (12 o\'clock position)', () => {
    const slices = computeSlices(['A'], [100]);
    expect(slices[0].startAngle).toBe(-Math.PI / 2);
  });
});
