/** Contract: contracts/sheets-chart/rules.md */

import { type BandScaleResult } from './types.ts';

export interface BandScaleOptions {
  labels: string[];
  rangeStart: number;
  rangeEnd: number;
  padding?: number;
}

export function createBandScale(options: BandScaleOptions): BandScaleResult {
  const { labels, rangeStart, rangeEnd, padding = 0.1 } = options;
  const count = labels.length;

  if (count === 0) {
    return {
      labels: [],
      bandwidth: 0,
      scale: () => rangeStart,
    };
  }

  const totalRange = rangeEnd - rangeStart;
  const paddingSize = totalRange * padding;
  const usableRange = totalRange - paddingSize * 2;
  const step = usableRange / count;
  const bandwidth = step * 0.8;

  const scale = (index: number): number => {
    return rangeStart + paddingSize + step * index + (step - bandwidth) / 2;
  };

  return { labels, bandwidth, scale };
}
