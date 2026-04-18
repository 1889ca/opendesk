/** Contract: contracts/sheets-chart/rules.md */

export type Point = { x: number; y: number };

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ChartArea = {
  plot: Rect;
  title: Rect;
  legendArea: Rect;
  xAxisLabel: Rect;
  yAxisLabel: Rect;
};

export type Tick = {
  value: number;
  label: string;
  position: number;
};

export type LinearScaleResult = {
  min: number;
  max: number;
  ticks: Tick[];
  scale: (value: number) => number;
};

export type BandScaleResult = {
  labels: string[];
  bandwidth: number;
  scale: (index: number) => number;
};

export type SeriesData = {
  name: string;
  values: number[];
  color: string;
};

export type PieSlice = {
  label: string;
  value: number;
  percentage: number;
  startAngle: number;
  endAngle: number;
  color: string;
};

export type ScatterPoint = {
  x: number;
  y: number;
  seriesIndex: number;
  color: string;
};

export type ChartError = {
  type: 'chart_error';
  message: string;
};

export function makeChartError(message: string): ChartError {
  return { type: 'chart_error', message };
}

export function isChartError(value: unknown): value is ChartError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as ChartError).type === 'chart_error'
  );
}
