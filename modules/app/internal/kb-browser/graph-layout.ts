/** Contract: contracts/app/rules.md */

import type { GraphData } from './graph-data.ts';

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
}

const REPULSION = 5000;
const SPRING_K = 0.02;
const SPRING_LENGTH = 120;
const DAMPING = 0.85;
const ITERATIONS = 100;
const PADDING = 60;

/** Run a simple force-directed layout. Returns positions for each node. */
export function computeLayout(data: GraphData, centerNodeId: string): LayoutResult {
  if (data.nodes.length === 0) return { positions: new Map(), width: 0, height: 0 };

  // Initialize positions in a circle around the center
  const nodes: LayoutNode[] = data.nodes.map((n, i) => {
    if (n.id === centerNodeId) return { id: n.id, x: 0, y: 0, vx: 0, vy: 0 };
    const angle = (2 * Math.PI * i) / data.nodes.length;
    const r = SPRING_LENGTH;
    return { id: n.id, x: Math.cos(angle) * r, y: Math.sin(angle) * r, vx: 0, vy: 0 };
  });

  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        applyRepulsion(nodes[i], nodes[j]);
      }
    }

    // Spring attraction along edges
    for (const edge of data.edges) {
      const si = nodeIndex.get(edge.source);
      const ti = nodeIndex.get(edge.target);
      if (si !== undefined && ti !== undefined) {
        applySpring(nodes[si], nodes[ti]);
      }
    }

    // Update positions with damping
    for (const node of nodes) {
      node.vx *= DAMPING;
      node.vy *= DAMPING;
      node.x += node.vx;
      node.y += node.vy;
    }
  }

  // Normalize positions to positive coordinates
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    positions.set(n.id, { x: n.x - minX + PADDING, y: n.y - minY + PADDING });
  }

  return {
    positions,
    width: maxX - minX + PADDING * 2,
    height: maxY - minY + PADDING * 2,
  };
}

function applyRepulsion(a: LayoutNode, b: LayoutNode): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distSq = dx * dx + dy * dy || 1;
  const force = REPULSION / distSq;
  const fx = (dx / Math.sqrt(distSq)) * force;
  const fy = (dy / Math.sqrt(distSq)) * force;
  a.vx -= fx;
  a.vy -= fy;
  b.vx += fx;
  b.vy += fy;
}

function applySpring(a: LayoutNode, b: LayoutNode): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const displacement = dist - SPRING_LENGTH;
  const force = SPRING_K * displacement;
  const fx = (dx / dist) * force;
  const fy = (dy / dist) * force;
  a.vx += fx;
  a.vy += fy;
  b.vx -= fx;
  b.vy -= fy;
}
