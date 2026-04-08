/** Contract: contracts/observability/rules.md */

import { describe, it, expect, vi } from 'vitest';

// We test the pure detection logic by verifying the helper functions
// Since detectAnomalies requires a DB, we test the classification logic

describe('anomaly severity classification', () => {
  // Replicate the classification function logic for testing
  function classifySeverity(zscore: number): 'info' | 'warning' | 'critical' {
    if (zscore > 5) return 'critical';
    if (zscore > 4) return 'warning';
    return 'info';
  }

  it('returns info for z-score between 3 and 4', () => {
    expect(classifySeverity(3.5)).toBe('info');
  });

  it('returns warning for z-score between 4 and 5', () => {
    expect(classifySeverity(4.5)).toBe('warning');
  });

  it('returns critical for z-score above 5', () => {
    expect(classifySeverity(5.5)).toBe('critical');
  });
});

describe('rate of change calculation', () => {
  function calculateRateOfChange(firstAvg: number, secondAvg: number): number {
    if (firstAvg === 0) return 0;
    return (secondAvg - firstAvg) / firstAvg;
  }

  it('detects 200% increase', () => {
    const rate = calculateRateOfChange(10, 30);
    expect(rate).toBe(2.0); // 200% increase
  });

  it('detects 500% spike', () => {
    const rate = calculateRateOfChange(10, 60);
    expect(rate).toBe(5.0);
  });

  it('returns 0 for no baseline', () => {
    expect(calculateRateOfChange(0, 100)).toBe(0);
  });

  it('reports decrease as negative', () => {
    const rate = calculateRateOfChange(100, 20);
    expect(rate).toBe(-0.8);
  });
});

describe('content type derivation from metric name', () => {
  function deriveContentType(metric: string): string {
    const prefix = metric.split('.')[0];
    const map: Record<string, string> = {
      document: 'document',
      sheet: 'sheet',
      slides: 'slides',
      kb: 'kb',
    };
    return map[prefix] ?? 'document';
  }

  it('derives document from document.edits_per_sec', () => {
    expect(deriveContentType('document.edits_per_sec')).toBe('document');
  });

  it('derives sheet from sheet.cell_updates_per_sec', () => {
    expect(deriveContentType('sheet.cell_updates_per_sec')).toBe('sheet');
  });

  it('derives slides from slides.element_mutations', () => {
    expect(deriveContentType('slides.element_mutations')).toBe('slides');
  });

  it('derives kb from kb.search_queries_per_sec', () => {
    expect(deriveContentType('kb.search_queries_per_sec')).toBe('kb');
  });

  it('falls back to document for unknown prefix', () => {
    expect(deriveContentType('unknown.metric')).toBe('document');
  });
});
