/** Contract: contracts/sheets-chart/rules.md */

import { type Rect, type ChartArea } from './types.ts';

export interface LayoutOptions {
  width: number;
  height: number;
  hasTitle: boolean;
  hasLegend: boolean;
  hasXLabel: boolean;
  hasYLabel: boolean;
}

const MARGIN = {
  top: 12,
  right: 16,
  bottom: 12,
  left: 16,
};

const TITLE_HEIGHT = 32;
const LEGEND_HEIGHT = 28;
const AXIS_LABEL_HEIGHT = 24;
const Y_AXIS_TICK_WIDTH = 52;
const X_AXIS_TICK_HEIGHT = 28;

export function computeLayout(options: LayoutOptions): ChartArea {
  const { width, height, hasTitle, hasLegend, hasXLabel, hasYLabel } = options;

  let plotTop = MARGIN.top;
  let plotBottom = height - MARGIN.bottom;
  let plotLeft = MARGIN.left + Y_AXIS_TICK_WIDTH;
  const plotRight = width - MARGIN.right;

  const titleRect: Rect = { x: 0, y: 0, width, height: 0 };
  if (hasTitle) {
    titleRect.height = TITLE_HEIGHT;
    plotTop += TITLE_HEIGHT;
  }

  if (hasYLabel) {
    plotLeft += AXIS_LABEL_HEIGHT;
  }

  plotBottom -= X_AXIS_TICK_HEIGHT;

  const xAxisLabelRect: Rect = { x: plotLeft, y: plotBottom, width: plotRight - plotLeft, height: 0 };
  if (hasXLabel) {
    plotBottom -= AXIS_LABEL_HEIGHT;
    xAxisLabelRect.y = plotBottom;
    xAxisLabelRect.height = AXIS_LABEL_HEIGHT;
  }

  const legendRect: Rect = { x: plotLeft, y: 0, width: plotRight - plotLeft, height: 0 };
  if (hasLegend) {
    plotBottom -= LEGEND_HEIGHT;
    legendRect.y = plotBottom;
    legendRect.height = LEGEND_HEIGHT;
  }

  const yAxisLabelRect: Rect = {
    x: MARGIN.left,
    y: plotTop,
    width: hasYLabel ? AXIS_LABEL_HEIGHT : 0,
    height: plotBottom - plotTop,
  };

  const plot: Rect = {
    x: plotLeft,
    y: plotTop,
    width: Math.max(0, plotRight - plotLeft),
    height: Math.max(0, plotBottom - plotTop),
  };

  return {
    plot,
    title: titleRect,
    legendArea: legendRect,
    xAxisLabel: xAxisLabelRect,
    yAxisLabel: yAxisLabelRect,
  };
}

export function computePieLayout(options: { width: number; height: number; hasTitle: boolean; hasLegend: boolean }): {
  centerX: number;
  centerY: number;
  radius: number;
  title: Rect;
  legendArea: Rect;
} {
  const { width, height, hasTitle, hasLegend } = options;

  let areaTop = MARGIN.top;
  let areaBottom = height - MARGIN.bottom;

  const titleRect: Rect = { x: 0, y: 0, width, height: 0 };
  if (hasTitle) {
    titleRect.height = TITLE_HEIGHT;
    areaTop += TITLE_HEIGHT;
  }

  const legendRect: Rect = { x: MARGIN.left, y: 0, width: width - MARGIN.left - MARGIN.right, height: 0 };
  if (hasLegend) {
    areaBottom -= LEGEND_HEIGHT;
    legendRect.y = areaBottom;
    legendRect.height = LEGEND_HEIGHT;
  }

  const availW = width - MARGIN.left - MARGIN.right;
  const availH = areaBottom - areaTop;
  const radius = Math.max(10, Math.min(availW, availH) / 2 - 8);
  const centerX = MARGIN.left + availW / 2;
  const centerY = areaTop + availH / 2;

  return { centerX, centerY, radius, title: titleRect, legendArea: legendRect };
}
