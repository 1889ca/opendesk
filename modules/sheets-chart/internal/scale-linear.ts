/** Contract: contracts/sheets-chart/rules.md */

import { type LinearScaleResult, type Tick } from './types.ts';

export interface LinearScaleOptions {
  values: number[];
  rangeStart: number;
  rangeEnd: number;
  tickCount?: number;
  forceZero?: boolean;
}

export function createLinearScale(options: LinearScaleOptions): LinearScaleResult {
  const { values, rangeStart, rangeEnd, tickCount = 5, forceZero = true } = options;

  if (values.length === 0) {
    return {
      min: 0,
      max: 1,
      ticks: [{ value: 0, label: '0', position: rangeStart }, { value: 1, label: '1', position: rangeEnd }],
      scale: () => rangeStart,
    };
  }

  let dataMin = Math.min(...values);
  let dataMax = Math.max(...values);

  if (dataMin === dataMax) {
    dataMin = dataMin === 0 ? -1 : dataMin * 0.9;
    dataMax = dataMax === 0 ? 1 : dataMax * 1.1;
  }

  if (forceZero) {
    if (dataMin > 0) dataMin = 0;
    if (dataMax < 0) dataMax = 0;
  }

  const { niceMin, niceMax, step } = niceRange(dataMin, dataMax, tickCount);

  const ticks: Tick[] = [];
  const range = rangeEnd - rangeStart;
  const domainSpan = niceMax - niceMin;

  for (let v = niceMin; v <= niceMax + step * 0.001; v += step) {
    const rounded = roundTo(v, 10);
    const position = rangeStart + ((rounded - niceMin) / domainSpan) * range;
    ticks.push({ value: rounded, label: formatTickLabel(rounded), position });
  }

  const scale = (value: number): number => {
    return rangeStart + ((value - niceMin) / domainSpan) * range;
  };

  return { min: niceMin, max: niceMax, ticks, scale };
}

function niceRange(
  dataMin: number,
  dataMax: number,
  tickCount: number,
): { niceMin: number; niceMax: number; step: number } {
  const rawStep = (dataMax - dataMin) / Math.max(tickCount - 1, 1);
  const step = niceStep(rawStep);
  const niceMin = Math.floor(dataMin / step) * step;
  const niceMax = Math.ceil(dataMax / step) * step;
  return { niceMin: roundTo(niceMin, 10), niceMax: roundTo(niceMax, 10), step };
}

function niceStep(rawStep: number): number {
  if (rawStep === 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(rawStep))));
  const normalized = rawStep / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function formatTickLabel(value: number): string {
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}
