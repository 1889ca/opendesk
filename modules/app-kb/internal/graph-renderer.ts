/** Contract: contracts/app-kb/rules.md */

import type { GraphData } from './graph-data.ts';
import { computeLayout } from './graph-layout.ts';

const NS = 'http://www.w3.org/2000/svg';

const TYPE_COLORS: Record<string, string> = {
  reference: '#3b82f6',
  entity: '#22c55e',
  dataset: '#f97316',
  note: '#a855f7',
  unknown: '#6b7280',
};

const NODE_RADIUS = 18;
const CENTER_RADIUS = 24;

/** Render an SVG force-directed graph into the given container. */
export function renderGraph(
  container: HTMLElement,
  data: GraphData,
  focusNodeId: string,
  onNodeClick: (id: string) => void,
): void {
  container.innerHTML = '';

  if (data.nodes.length === 0) {
    container.textContent = 'No related entries to display.';
    return;
  }

  const layout = computeLayout(data, focusNodeId);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'kb-graph-svg');
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // Build a node lookup for edge rendering
  const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));

  // Render edges first (behind nodes)
  for (const edge of data.edges) {
    const sp = layout.positions.get(edge.source);
    const tp = layout.positions.get(edge.target);
    if (!sp || !tp) continue;

    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', String(sp.x));
    line.setAttribute('y1', String(sp.y));
    line.setAttribute('x2', String(tp.x));
    line.setAttribute('y2', String(tp.y));
    line.setAttribute('class', 'kb-graph-edge');

    // Edge label at midpoint
    const label = document.createElementNS(NS, 'text');
    label.setAttribute('x', String((sp.x + tp.x) / 2));
    label.setAttribute('y', String((sp.y + tp.y) / 2 - 6));
    label.setAttribute('class', 'kb-graph-edge-label');
    label.textContent = edge.relationType;

    svg.appendChild(line);
    svg.appendChild(label);
  }

  // Render nodes
  for (const node of data.nodes) {
    const pos = layout.positions.get(node.id);
    if (!pos) continue;
    const isFocus = node.id === focusNodeId;
    const r = isFocus ? CENTER_RADIUS : NODE_RADIUS;
    const color = TYPE_COLORS[node.entryType] ?? TYPE_COLORS.unknown;

    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', `kb-graph-node${isFocus ? ' kb-graph-node--focus' : ''}`);
    g.setAttribute('transform', `translate(${pos.x},${pos.y})`);
    g.style.cursor = 'pointer';
    g.addEventListener('click', () => onNodeClick(node.id));

    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('r', String(r));
    circle.setAttribute('fill', color);
    circle.setAttribute('class', isFocus ? 'kb-graph-circle--focus' : 'kb-graph-circle');

    const text = document.createElementNS(NS, 'text');
    text.setAttribute('y', String(r + 14));
    text.setAttribute('class', 'kb-graph-label');
    text.textContent = truncateLabel(node.title, 18);

    const title = document.createElementNS(NS, 'title');
    title.textContent = `${node.title} (${node.entryType})`;

    g.appendChild(title);
    g.appendChild(circle);
    g.appendChild(text);
    svg.appendChild(g);
  }

  container.appendChild(svg);
}

function truncateLabel(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '\u2026' : text;
}
