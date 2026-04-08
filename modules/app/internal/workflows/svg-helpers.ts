/** Contract: contracts/workflow/rules.md */
import type { WorkflowNode, WorkflowEdge } from './types.ts';

export const NS = 'http://www.w3.org/2000/svg';
export const NODE_W = 160;
export const NODE_H = 56;
export const PORT_R = 6;

export const NODE_COLORS: Record<string, { fill: string; stroke: string }> = {
  trigger: { fill: 'var(--wf-trigger-fill)', stroke: 'var(--wf-trigger-stroke)' },
  condition: { fill: 'var(--wf-condition-fill)', stroke: 'var(--wf-condition-stroke)' },
  action: { fill: 'var(--wf-action-fill)', stroke: 'var(--wf-action-stroke)' },
  parallel_split: { fill: 'var(--wf-split-fill)', stroke: 'var(--wf-split-stroke)' },
};

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export function edgePoints(src: WorkflowNode, tgt: WorkflowNode) {
  return {
    x1: src.x + NODE_W / 2,
    y1: src.y + NODE_H,
    x2: tgt.x + NODE_W / 2,
    y2: tgt.y,
  };
}

export function renderEdgeSvg(
  edge: WorkflowEdge,
  nodes: WorkflowNode[],
  onSelect: (edgeId: string) => void,
): SVGGElement {
  const src = nodes.find((n) => n.id === edge.sourceId);
  const tgt = nodes.find((n) => n.id === edge.targetId);
  if (!src || !tgt) return svgEl('g');

  const g = svgEl('g', { 'data-edge-id': edge.id });
  const { x1, y1, x2, y2 } = edgePoints(src, tgt);
  const midY = (y1 + y2) / 2;
  const d = `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;

  const hit = svgEl('path', {
    d, class: 'wf-edge-hit', 'stroke-width': '12', stroke: 'transparent', fill: 'none',
  });
  hit.addEventListener('click', () => onSelect(edge.id));
  g.appendChild(hit);

  g.appendChild(svgEl('path', {
    d, class: 'wf-edge-line', fill: 'none',
    stroke: 'var(--wf-edge-color)', 'stroke-width': '2',
    'marker-end': 'url(#wf-arrow)',
  }));

  if (edge.label) {
    const lx = (x1 + x2) / 2;
    const ly = midY - 8;
    const text = svgEl('text', {
      x: String(lx), y: String(ly), class: 'wf-edge-label', 'text-anchor': 'middle',
    });
    text.textContent = edge.label;
    g.appendChild(text);
  }

  return g;
}

export function renderNodeSvg(
  node: WorkflowNode,
  selected: boolean,
): SVGGElement {
  const g = svgEl('g', {
    class: 'wf-node',
    'data-node-id': node.id,
    transform: `translate(${node.x}, ${node.y})`,
  });

  const colors = NODE_COLORS[node.type] ?? NODE_COLORS.action;

  if (node.type === 'condition') {
    const cx = NODE_W / 2;
    const cy = NODE_H / 2;
    g.appendChild(svgEl('polygon', {
      points: `${cx},0 ${NODE_W},${cy} ${cx},${NODE_H} 0,${cy}`,
      fill: colors.fill, stroke: colors.stroke, 'stroke-width': '2',
    }));
  } else {
    g.appendChild(svgEl('rect', {
      width: String(NODE_W), height: String(NODE_H),
      rx: '8', ry: '8',
      fill: colors.fill, stroke: colors.stroke, 'stroke-width': '2',
    }));
  }

  const badge = svgEl('text', { x: '8', y: '16', class: 'wf-node-type' });
  badge.textContent = node.type.replace('_', ' ');
  g.appendChild(badge);

  const label = svgEl('text', {
    x: String(NODE_W / 2), y: String(NODE_H / 2 + 6),
    'text-anchor': 'middle', class: 'wf-node-label',
  });
  label.textContent = node.label || node.type;
  g.appendChild(label);

  g.appendChild(svgEl('circle', {
    cx: String(NODE_W / 2), cy: String(NODE_H),
    r: String(PORT_R), class: 'wf-port wf-port-out',
  }));

  if (node.type !== 'trigger') {
    g.appendChild(svgEl('circle', {
      cx: String(NODE_W / 2), cy: '0',
      r: String(PORT_R), class: 'wf-port wf-port-in',
    }));
  }

  if (node.type === 'condition') {
    g.appendChild(svgEl('circle', {
      cx: '0', cy: String(NODE_H / 2),
      r: String(PORT_R), class: 'wf-port wf-port-false',
    }));
    g.appendChild(svgEl('circle', {
      cx: String(NODE_W), cy: String(NODE_H / 2),
      r: String(PORT_R), class: 'wf-port wf-port-true',
    }));
  }

  if (selected) g.classList.add('wf-node--selected');
  return g;
}

export function createArrowDefs(): SVGDefsElement {
  const defs = svgEl('defs');
  const marker = svgEl('marker', {
    id: 'wf-arrow', viewBox: '0 0 10 10',
    refX: '10', refY: '5',
    markerWidth: '8', markerHeight: '8', orient: 'auto-start-reverse',
  });
  marker.appendChild(svgEl('path', {
    d: 'M0,0 L10,5 L0,10 z', fill: 'var(--wf-edge-color)',
  }));
  defs.appendChild(marker);
  return defs;
}
