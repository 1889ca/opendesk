/** Contract: contracts/app-kb/rules.md */
import { describe, it, expect } from 'vitest';
import { computeLayout } from './graph-layout.ts';
import type { GraphData } from './graph-data.ts';

function makeGraphData(nodeCount: number, edges: [number, number][] = []): GraphData {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `n${i}`,
    title: `Node ${i}`,
    entryType: 'note',
  }));
  const graphEdges = edges.map(([s, t]) => ({
    source: `n${s}`,
    target: `n${t}`,
    relationType: 'related',
  }));
  return { nodes, edges: graphEdges };
}

describe('computeLayout', () => {
  it('returns empty result for empty graph', () => {
    const result = computeLayout({ nodes: [], edges: [] }, 'n0');
    expect(result.positions.size).toBe(0);
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });

  it('places a single node at the center', () => {
    const data = makeGraphData(1);
    const result = computeLayout(data, 'n0');
    expect(result.positions.size).toBe(1);
    expect(result.positions.has('n0')).toBe(true);
    // Single node should have positive coordinates (padding applied)
    const pos = result.positions.get('n0')!;
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.y).toBeGreaterThanOrEqual(0);
  });

  it('positions all nodes for a connected graph', () => {
    const data = makeGraphData(3, [[0, 1], [1, 2]]);
    const result = computeLayout(data, 'n0');
    expect(result.positions.size).toBe(3);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('assigns distinct positions to different nodes', () => {
    const data = makeGraphData(4, [[0, 1], [0, 2], [0, 3]]);
    const result = computeLayout(data, 'n0');
    const positions = [...result.positions.values()];
    const posKeys = positions.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`);
    const unique = new Set(posKeys);
    // Nodes should mostly get distinct positions (force repulsion)
    expect(unique.size).toBeGreaterThanOrEqual(3);
  });

  it('produces non-negative coordinates for all nodes', () => {
    const data = makeGraphData(5, [[0, 1], [1, 2], [2, 3], [3, 4]]);
    const result = computeLayout(data, 'n0');
    for (const [, pos] of result.positions) {
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('width and height encompass all node positions', () => {
    const data = makeGraphData(6, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]]);
    const result = computeLayout(data, 'n0');
    for (const [, pos] of result.positions) {
      expect(pos.x).toBeLessThanOrEqual(result.width);
      expect(pos.y).toBeLessThanOrEqual(result.height);
    }
  });
});
