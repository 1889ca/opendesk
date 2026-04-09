/** Contract: contracts/app/charts.md */
import * as Y from 'yjs';
import {
  createChartId,
  DEFAULT_CHART_SIZE,
  DEFAULT_COLORS,
  chartDefToJSON,
  jsonToChartDef,
  type ChartDef,
  type ChartRange,
  type ChartType,
  type ChartPosition,
  type ChartSize,
} from './chart-types.ts';
import { extractChartData, extractPieData } from './chart-data.ts';
import { createChartOverlay } from './chart-overlay.ts';
import { renderBarChart } from './bar-chart.ts';
import { renderLineChart } from './line-chart.ts';
import { renderPieChart } from './pie-chart.ts';

interface ChartInstance {
  def: ChartDef;
  canvas: HTMLCanvasElement;
  destroy: () => void;
}

export class ChartManager {
  private ydoc: Y.Doc;
  private ysheet: Y.Array<Y.Array<string>>;
  private ycharts: Y.Map<Record<string, unknown>>;
  private container: HTMLElement;
  private instances = new Map<string, ChartInstance>();

  constructor(
    ydoc: Y.Doc,
    ysheet: Y.Array<Y.Array<string>>,
    container: HTMLElement,
  ) {
    this.ydoc = ydoc;
    this.ysheet = ysheet;
    this.ycharts = ydoc.getMap<Record<string, unknown>>('charts-0');
    this.container = container;
    this.observeCharts();
    this.observeData();
    this.syncFromYjs();
  }

  insertChart(type: ChartType, range: ChartRange, title?: string): void {
    const id = createChartId();
    const def: ChartDef = {
      id,
      type,
      range,
      position: this.nextPosition(),
      size: { ...DEFAULT_CHART_SIZE },
      title: title || this.defaultTitle(type),
      colors: [...DEFAULT_COLORS],
    };
    this.ydoc.transact(() => {
      this.ycharts.set(id, chartDefToJSON(def));
    });
  }

  private defaultTitle(type: ChartType): string {
    const titles: Record<ChartType, string> = {
      bar: 'Bar Chart', line: 'Line Chart', pie: 'Pie Chart',
    };
    return titles[type];
  }

  private nextPosition(): ChartPosition {
    const offset = this.instances.size * 30;
    return { x: 50 + offset, y: 50 + offset };
  }

  private observeCharts(): void {
    this.ycharts.observe(() => this.syncFromYjs());
  }

  private observeData(): void {
    this.ysheet.observeDeep(() => this.rerenderAll());
  }

  private syncFromYjs(): void {
    const currentIds = new Set<string>();

    this.ycharts.forEach((json, id) => {
      currentIds.add(id);
      const def = jsonToChartDef(json);
      if (!def) return;

      const existing = this.instances.get(id);
      if (existing) {
        Object.assign(existing.def, def);
        existing.canvas.width = def.size.width;
        existing.canvas.height = def.size.height - 28;
        this.renderChart(existing);
      } else {
        this.createInstance(def);
      }
    });

    // Remove deleted charts
    for (const [id, inst] of this.instances) {
      if (!currentIds.has(id)) {
        inst.destroy();
        this.instances.delete(id);
      }
    }
  }

  private createInstance(def: ChartDef): void {
    const overlay = createChartOverlay(this.container, def, {
      onMove: (id, pos) => this.updateChart(id, { position: pos }),
      onResize: (id, size) => this.updateChart(id, { size }),
      onDelete: (id) => this.deleteChart(id),
    });

    const inst: ChartInstance = {
      def,
      canvas: overlay.canvas,
      destroy: overlay.destroy,
    };
    this.instances.set(def.id, inst);
    this.renderChart(inst);
  }

  private updateChart(id: string, patch: Partial<ChartDef>): void {
    const json = this.ycharts.get(id);
    if (!json) return;
    this.ydoc.transact(() => {
      this.ycharts.set(id, { ...json, ...patch });
    });
  }

  private deleteChart(id: string): void {
    this.ydoc.transact(() => {
      this.ycharts.delete(id);
    });
  }

  private rerenderAll(): void {
    for (const inst of this.instances.values()) {
      this.renderChart(inst);
    }
  }

  private renderChart(inst: ChartInstance): void {
    const ctx = inst.canvas.getContext('2d');
    if (!ctx) return;
    const { def } = inst;
    const w = inst.canvas.width;
    const h = inst.canvas.height;

    if (def.type === 'pie') {
      const pieData = extractPieData(this.ysheet, def.range);
      renderPieChart(ctx, w, h, pieData, def.title, def.colors);
    } else {
      const data = extractChartData(this.ysheet, def.range);
      if (def.type === 'bar') {
        renderBarChart(ctx, w, h, data, def.title, def.colors);
      } else {
        renderLineChart(ctx, w, h, data, def.title, def.colors);
      }
    }
  }

  destroy(): void {
    for (const inst of this.instances.values()) inst.destroy();
    this.instances.clear();
  }
}
