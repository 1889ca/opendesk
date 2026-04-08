/** Contract: contracts/app/charts.md */

export type ChartType = 'bar' | 'line' | 'pie';

export interface ChartRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface ChartPosition {
  x: number;
  y: number;
}

export interface ChartSize {
  width: number;
  height: number;
}

export interface ChartDef {
  id: string;
  type: ChartType;
  range: ChartRange;
  position: ChartPosition;
  size: ChartSize;
  title: string;
  colors: string[];
}

export const DEFAULT_CHART_SIZE: ChartSize = { width: 400, height: 300 };

export const DEFAULT_COLORS = [
  '#4285f4', '#ea4335', '#fbbc04', '#34a853',
  '#ff6d01', '#46bdc6', '#7baaf7', '#f07b72',
  '#fcd04f', '#71c287', '#ff9e40', '#78d9e0',
];

export function createChartId(): string {
  return `chart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function chartDefToJSON(def: ChartDef): Record<string, unknown> {
  return {
    id: def.id,
    type: def.type,
    range: { ...def.range },
    position: { ...def.position },
    size: { ...def.size },
    title: def.title,
    colors: [...def.colors],
  };
}

export function jsonToChartDef(json: Record<string, unknown>): ChartDef | null {
  if (!json || typeof json.id !== 'string' || typeof json.type !== 'string') {
    return null;
  }
  const range = json.range as ChartRange;
  const position = json.position as ChartPosition;
  const size = json.size as ChartSize;
  if (!range || !position || !size) return null;

  return {
    id: json.id as string,
    type: json.type as ChartType,
    range,
    position,
    size,
    title: (json.title as string) || '',
    colors: (json.colors as string[]) || [...DEFAULT_COLORS],
  };
}
