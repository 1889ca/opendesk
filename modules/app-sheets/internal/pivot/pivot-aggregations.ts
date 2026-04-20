/** Contract: contracts/app-sheets/rules.md */

export type AggregationType =
  | 'SUM' | 'COUNT' | 'AVERAGE' | 'MIN' | 'MAX'
  | 'MEDIAN' | 'STDEV' | 'PRODUCT' | 'COUNT_DISTINCT';

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function aggregate(
  values: number[],
  type: AggregationType,
): number | null {
  if (values.length === 0) return null;
  switch (type) {
    case 'SUM':
      return values.reduce((a, b) => a + b, 0);
    case 'COUNT':
      return values.length;
    case 'AVERAGE':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'MIN':
      return Math.min(...values);
    case 'MAX':
      return Math.max(...values);
    case 'MEDIAN':
      return median(values);
    case 'STDEV':
      return stdev(values);
    case 'PRODUCT':
      return values.reduce((a, b) => a * b, 1);
    case 'COUNT_DISTINCT':
      return new Set(values).size;
  }
}

export const AGGREGATION_LABELS: Record<AggregationType, string> = {
  SUM: 'Sum',
  COUNT: 'Count',
  AVERAGE: 'Average',
  MIN: 'Min',
  MAX: 'Max',
  MEDIAN: 'Median',
  STDEV: 'Std Dev',
  PRODUCT: 'Product',
  COUNT_DISTINCT: 'Count Distinct',
};
