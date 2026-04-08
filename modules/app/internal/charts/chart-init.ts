/** Contract: contracts/app/charts.md */
import * as Y from 'yjs';
import type { ChartRange } from './chart-types.ts';
import { ChartManager } from './chart-manager.ts';
import { createChartToolbar } from './chart-toolbar.ts';

export interface SelectionState {
  getSelection(): ChartRange | null;
}

export function initCharts(
  ydoc: Y.Doc,
  ysheet: Y.Array<Y.Array<string>>,
  chartContainer: HTMLElement,
  toolbarMount: HTMLElement | null,
  selectionState: SelectionState,
): ChartManager {
  const chartManager = new ChartManager(ydoc, ysheet, chartContainer);

  if (toolbarMount) {
    const toolbar = createChartToolbar(chartManager, selectionState);
    toolbarMount.appendChild(toolbar);
  }

  return chartManager;
}
