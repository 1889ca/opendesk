/** Contract: contracts/workflow/rules.md */
import type { WorkflowNode, WorkflowEdge } from './types.ts';

const NS = 'http://www.w3.org/2000/svg';
const NODE_W = 160;
const NODE_H = 56;
const PORT_R = 6;

const NODE_COLORS: Record<string, { fill: string; stroke: string }> = {
  trigger: { fill: 'var(--wf-trigger-fill)', stroke: 'var(--wf-trigger-stroke)' },
  condition: { fill: 'var(--wf-condition-fill)', stroke: 'var(--wf-condition-stroke)' },
  action: { fill: 'var(--wf-action-fill)', stroke: 'var(--wf-action-stroke)' },
  parallel_split: { fill: 'var(--wf-split-fill)', stroke: 'var(--wf-split-stroke)' },
};

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** Calculate connection point at bottom of source, top of target */
function edgePoints(src: WorkflowNode, tgt: WorkflowNode) {
  return {
    x1: src.x + NODE_W / 2,
    y1: src.y + NODE_H,
    x2: tgt.x + NODE_W / 2,
    y2: tgt.y,
  };
}

export type CanvasCallbacks = {
  onNodeSelect: (nodeId: string | null) => void;
  onNodeMove: (nodeId: string, x: number, y: number) => void;
  onEdgeSelect: (edgeId: string | null) => void;
};

export function createCanvasRenderer(
  container: HTMLElement,
  callbacks: CanvasCallbacks,
) {
  const svg = svgEl('svg', { class: 'wf-canvas' });
  container.appendChild(svg);

  const edgeGroup = svgEl('g', { class: 'wf-edges' });
  const nodeGroup = svgEl('g', { class: 'wf-nodes' });
  svg.appendChild(edgeGroup);
  svg.appendChild(nodeGroup);

  let selectedNodeId: string | null = null;
  let dragState: { nodeId: string; offsetX: number; offsetY: number } | null = null;

  // Pan state
  let panX = 0;
  let panY = 0;

  function screenToCanvas(clientX: number, clientY: number) {
    const rect = svg.getBoundingClientRect();
    return { x: clientX - rect.left - panX, y: clientY - rect.top - panY };
  }

  svg.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('.wf-node')) return;
    if ((e.target as Element).closest('.wf-edge-hit')) return;
    callbacks.onNodeSelect(null);
    callbacks.onEdgeSelect(null);
    selectedNodeId = null;
  });

  function renderEdge(
    edge: WorkflowEdge,
    nodes: WorkflowNode[],
  ): SVGGElement {
    const src = nodes.find((n) => n.id === edge.sourceId);
    const tgt = nodes.find((n) => n.id === edge.targetId);
    if (!src || !tgt) return svgEl('g');

    const g = svgEl('g', { 'data-edge-id': edge.id });
    const { x1, y1, x2, y2 } = edgePoints(src, tgt);

    const midY = (y1 + y2) / 2;
    const d = `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;

    // Hit area (invisible, wider for click)
    const hit = svgEl('path', {
      d, class: 'wf-edge-hit', 'stroke-width': '12', stroke: 'transparent', fill: 'none',
    });
    hit.addEventListener('click', () => callbacks.onEdgeSelect(edge.id));
    g.appendChild(hit);

    // Visible line
    const path = svgEl('path', {
      d,
      class: 'wf-edge-line',
      fill: 'none',
      stroke: 'var(--wf-edge-color)',
      'stroke-width': '2',
      'marker-end': 'url(#wf-arrow)',
    });
    g.appendChild(path);

    // Edge label
    if (edge.label) {
      const lx = (x1 + x2) / 2;
      const ly = midY - 8;
      const text = svgEl('text', {
        x: String(lx), y: String(ly), class: 'wf-edge-label',
        'text-anchor': 'middle',
      });
      text.textContent = edge.label;
      g.appendChild(text);
    }

    return g;
  }

  function renderNode(node: WorkflowNode): SVGGElement {
    const g = svgEl('g', {
      class: 'wf-node',
      'data-node-id': node.id,
      transform: `translate(${node.x}, ${node.y})`,
    });

    const colors = NODE_COLORS[node.type] ?? NODE_COLORS.action;

    // Shape: diamond for condition, rectangle for others
    if (node.type === 'condition') {
      const cx = NODE_W / 2;
      const cy = NODE_H / 2;
      const pts = `${cx},0 ${NODE_W},${cy} ${cx},${NODE_H} 0,${cy}`;
      g.appendChild(svgEl('polygon', {
        points: pts,
        fill: colors.fill, stroke: colors.stroke, 'stroke-width': '2',
        rx: '4',
      }));
    } else {
      g.appendChild(svgEl('rect', {
        width: String(NODE_W), height: String(NODE_H),
        rx: '8', ry: '8',
        fill: colors.fill, stroke: colors.stroke, 'stroke-width': '2',
      }));
    }

    // Type badge
    const badge = svgEl('text', {
      x: '8', y: '16', class: 'wf-node-type',
    });
    badge.textContent = node.type.replace('_', ' ');
    g.appendChild(badge);

    // Label
    const label = svgEl('text', {
      x: String(NODE_W / 2), y: String(NODE_H / 2 + 6),
      'text-anchor': 'middle', class: 'wf-node-label',
    });
    label.textContent = node.label || node.type;
    g.appendChild(label);

    // Output port (bottom center)
    g.appendChild(svgEl('circle', {
      cx: String(NODE_W / 2), cy: String(NODE_H),
      r: String(PORT_R), class: 'wf-port wf-port-out',
    }));

    // Input port (top center) for non-trigger nodes
    if (node.type !== 'trigger') {
      g.appendChild(svgEl('circle', {
        cx: String(NODE_W / 2), cy: '0',
        r: String(PORT_R), class: 'wf-port wf-port-in',
      }));
    }

    // Condition: two output ports (left = false, right = true)
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

    // Selection highlight
    if (node.id === selectedNodeId) {
      g.classList.add('wf-node--selected');
    }

    // Drag handling
    g.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const pt = screenToCanvas(e.clientX, e.clientY);
      dragState = { nodeId: node.id, offsetX: pt.x - node.x, offsetY: pt.y - node.y };
      selectedNodeId = node.id;
      callbacks.onNodeSelect(node.id);
      svg.setPointerCapture(e.pointerId);
    });

    return g;
  }

  svg.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    const pt = screenToCanvas(e.clientX, e.clientY);
    const x = Math.round((pt.x - dragState.offsetX) / 10) * 10;
    const y = Math.round((pt.y - dragState.offsetY) / 10) * 10;
    callbacks.onNodeMove(dragState.nodeId, x, y);
  });

  svg.addEventListener('pointerup', () => {
    dragState = null;
  });

  function render(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
    // Clear
    while (edgeGroup.firstChild) edgeGroup.removeChild(edgeGroup.firstChild);
    while (nodeGroup.firstChild) nodeGroup.removeChild(nodeGroup.firstChild);

    // Arrow marker
    const defs = svgEl('defs');
    const marker = svgEl('marker', {
      id: 'wf-arrow', viewBox: '0 0 10 10',
      refX: '10', refY: '5',
      markerWidth: '8', markerHeight: '8',
      orient: 'auto-start-reverse',
    });
    marker.appendChild(svgEl('path', {
      d: 'M0,0 L10,5 L0,10 z', fill: 'var(--wf-edge-color)',
    }));
    defs.appendChild(marker);
    svg.insertBefore(defs, edgeGroup);

    // Render edges first (behind nodes)
    for (const edge of edges) {
      edgeGroup.appendChild(renderEdge(edge, nodes));
    }

    // Render nodes
    for (const node of nodes) {
      nodeGroup.appendChild(renderNode(node));
    }

    // Update viewBox to encompass all nodes
    if (nodes.length > 0) {
      const pad = 100;
      const minX = Math.min(...nodes.map((n) => n.x)) - pad;
      const minY = Math.min(...nodes.map((n) => n.y)) - pad;
      const maxX = Math.max(...nodes.map((n) => n.x + NODE_W)) + pad;
      const maxY = Math.max(...nodes.map((n) => n.y + NODE_H)) + pad;
      svg.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
    }
  }

  function setSelected(nodeId: string | null) {
    selectedNodeId = nodeId;
  }

  return { svg, render, setSelected };
}
