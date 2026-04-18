/** Contract: contracts/sheets-chart/rules.md */

import { type ChartConfig, type ChartDataInput, type ChartOutput, ChartConfigSchema, ChartDataInputSchema } from '../contract.ts';
import { extractSeries, type ExtractedData } from './data-series.ts';
import { isChartError } from './types.ts';
import { renderBarChart } from './render-bar.ts';
import { renderLineChart } from './render-line.ts';
import { renderPieChart } from './render-pie.ts';
import { renderScatterChart, type ScatterSeries } from './render-scatter.ts';
import { getColor } from './color-palette.ts';
import { type PaletteName } from './color-palette.ts';
import * as svg from './svg-builder.ts';

export function renderChart(rawConfig: ChartConfig, rawData: ChartDataInput): ChartOutput {
  const configResult = ChartConfigSchema.safeParse(rawConfig);
  if (!configResult.success) {
    return { type: 'chart_error', message: `Invalid config: ${configResult.error.message}` };
  }
  const config = configResult.data;

  const dataResult = ChartDataInputSchema.safeParse(rawData);
  if (!dataResult.success) {
    return { type: 'chart_error', message: `Invalid data: ${dataResult.error.message}` };
  }
  const data = dataResult.data;

  if (data.length === 0) {
    return { type: 'svg', svg: renderEmptyChart(config.width, config.height, config.title) };
  }

  if (config.type === 'scatter') {
    return renderScatter(config, data);
  }

  if (config.type === 'pie') {
    return renderPie(config, data);
  }

  return renderCartesian(config, data);
}

function renderCartesian(config: ChartConfig, data: ChartDataInput): ChartOutput {
  const extracted = extractSeries(data, {
    orientation: config.orientation,
    hasHeaders: config.hasHeaders,
    seriesIndices: config.seriesIndices,
    categoryIndex: config.categoryIndex,
    palette: config.palette as PaletteName,
  });

  if (isChartError(extracted)) return extracted;
  const { categories, series } = extracted as ExtractedData;

  if (config.type === 'bar') {
    return {
      type: 'svg',
      svg: renderBarChart({
        width: config.width, height: config.height,
        title: config.title, xLabel: config.xLabel, yLabel: config.yLabel,
        categories, series, stacked: config.stacked,
      }),
    };
  }

  return {
    type: 'svg',
    svg: renderLineChart({
      width: config.width, height: config.height,
      title: config.title, xLabel: config.xLabel, yLabel: config.yLabel,
      categories, series,
      showDots: config.showDots, showArea: config.showArea,
    }),
  };
}

function renderPie(config: ChartConfig, data: ChartDataInput): ChartOutput {
  const extracted = extractSeries(data, {
    orientation: config.orientation,
    hasHeaders: config.hasHeaders,
    seriesIndices: config.seriesIndices,
    categoryIndex: config.categoryIndex,
    palette: config.palette as PaletteName,
  });

  if (isChartError(extracted)) return extracted;
  const { categories, series } = extracted as ExtractedData;

  const firstSeries = series[0];
  if (!firstSeries) return { type: 'chart_error', message: 'No data series for pie chart' };

  return {
    type: 'svg',
    svg: renderPieChart({
      width: config.width, height: config.height,
      title: config.title,
      labels: categories,
      values: firstSeries.values,
      palette: config.palette as PaletteName,
      showPercentages: config.showPercentages,
    }),
  };
}

function renderScatter(config: ChartConfig, data: ChartDataInput): ChartOutput {
  const defs = config.scatterSeries;
  if (!defs || defs.length === 0) {
    return { type: 'chart_error', message: 'Scatter chart requires scatterSeries definitions' };
  }

  const startRow = config.hasHeaders ? 1 : 0;
  const headers = config.hasHeaders ? data[0] : undefined;

  const scatterSeries: ScatterSeries[] = defs.map((def, i) => {
    const name = def.name ?? headers?.[def.yIndex] ?? `Series ${i + 1}`;
    const points: { x: number; y: number }[] = [];

    for (let r = startRow; r < data.length; r++) {
      const xVal = parseFloat(data[r]?.[def.xIndex] ?? '');
      const yVal = parseFloat(data[r]?.[def.yIndex] ?? '');
      if (!isNaN(xVal) && !isNaN(yVal)) {
        points.push({ x: xVal, y: yVal });
      }
    }

    return { name, points, color: getColor(i, config.palette as PaletteName) };
  });

  return {
    type: 'svg',
    svg: renderScatterChart({
      width: config.width, height: config.height,
      title: config.title, xLabel: config.xLabel, yLabel: config.yLabel,
      series: scatterSeries,
    }),
  };
}

function renderEmptyChart(width: number, height: number, title?: string): string {
  const parts: string[] = [];
  parts.push(svg.rect(0, 0, width, height, '#fff'));
  if (title) {
    parts.push(svg.text(width / 2, 24, title, { fontSize: 14, fill: '#222' }));
  }
  parts.push(svg.text(width / 2, height / 2, 'No data', { fontSize: 14, fill: '#999' }));
  return svg.svgOpen(width, height) + parts.join('') + svg.svgClose();
}
