/** Contract: contracts/app-sheets/rules.md */
import { describe, it, expect } from 'vitest';
import { aggregate } from './pivot-aggregations.ts';

describe('aggregate — basic operations', () => {
  it('SUM adds values', () => {
    expect(aggregate([1, 2, 3], 'SUM')).toBe(6);
  });

  it('COUNT returns length', () => {
    expect(aggregate([10, 20, 30], 'COUNT')).toBe(3);
  });

  it('AVERAGE computes mean', () => {
    expect(aggregate([10, 20, 30], 'AVERAGE')).toBe(20);
  });

  it('MIN finds minimum', () => {
    expect(aggregate([5, 3, 8], 'MIN')).toBe(3);
  });

  it('MAX finds maximum', () => {
    expect(aggregate([5, 3, 8], 'MAX')).toBe(8);
  });
});

describe('aggregate — new aggregation types', () => {
  it('MEDIAN of odd-length array', () => {
    expect(aggregate([1, 3, 5], 'MEDIAN')).toBe(3);
  });

  it('MEDIAN of even-length array', () => {
    expect(aggregate([1, 3, 5, 7], 'MEDIAN')).toBe(4);
  });

  it('MEDIAN of unsorted array', () => {
    expect(aggregate([7, 1, 5, 3], 'MEDIAN')).toBe(4);
  });

  it('STDEV computes sample standard deviation', () => {
    const val = aggregate([2, 4, 4, 4, 5, 5, 7, 9], 'STDEV');
    expect(val).toBeCloseTo(2.138, 2);
  });

  it('STDEV of single value is 0', () => {
    expect(aggregate([42], 'STDEV')).toBe(0);
  });

  it('PRODUCT multiplies all values', () => {
    expect(aggregate([2, 3, 4], 'PRODUCT')).toBe(24);
  });

  it('PRODUCT of single value', () => {
    expect(aggregate([7], 'PRODUCT')).toBe(7);
  });

  it('COUNT_DISTINCT counts unique values', () => {
    expect(aggregate([1, 2, 2, 3, 3, 3], 'COUNT_DISTINCT')).toBe(3);
  });

  it('COUNT_DISTINCT of all same', () => {
    expect(aggregate([5, 5, 5], 'COUNT_DISTINCT')).toBe(1);
  });

  it('COUNT_DISTINCT of all unique', () => {
    expect(aggregate([1, 2, 3, 4], 'COUNT_DISTINCT')).toBe(4);
  });
});

describe('aggregate — empty input', () => {
  it('returns null for empty arrays regardless of type', () => {
    expect(aggregate([], 'SUM')).toBeNull();
    expect(aggregate([], 'COUNT')).toBeNull();
    expect(aggregate([], 'AVERAGE')).toBeNull();
    expect(aggregate([], 'MEDIAN')).toBeNull();
    expect(aggregate([], 'STDEV')).toBeNull();
    expect(aggregate([], 'PRODUCT')).toBeNull();
    expect(aggregate([], 'COUNT_DISTINCT')).toBeNull();
    expect(aggregate([], 'MIN')).toBeNull();
    expect(aggregate([], 'MAX')).toBeNull();
  });
});
