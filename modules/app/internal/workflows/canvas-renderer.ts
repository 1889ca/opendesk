/** Contract: contracts/workflow/rules.md */
import type { WorkflowNode, WorkflowEdge } from './types.ts';
import { svgEl, NODE_W, NODE_H, renderEdgeSvg, renderNodeSvg, createArrowDefs } from './svg-helpers.ts';

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
  const panX = 0;
  const panY = 0;

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

  svg.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    const pt = screenToCanvas(e.clientX, e.clientY);
    const x = Math.round((pt.x - dragState.offsetX) / 10) * 10;
    const y = Math.round((pt.y - dragState.offsetY) / 10) * 10;
    callbacks.onNodeMove(dragState.nodeId, x, y);
  });

  svg.addEventListener('pointerup', () => { dragState = null; });

  function attachNodeDrag(g: SVGGElement, node: WorkflowNode) {
    g.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const pt = screenToCanvas(e.clientX, e.clientY);
      dragState = { nodeId: node.id, offsetX: pt.x - node.x, offsetY: pt.y - node.y };
      selectedNodeId = node.id;
      callbacks.onNodeSelect(node.id);
      svg.setPointerCapture(e.pointerId);
    });
  }

  function render(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
    while (edgeGroup.firstChild) edgeGroup.removeChild(edgeGroup.firstChild);
    while (nodeGroup.firstChild) nodeGroup.removeChild(nodeGroup.firstChild);

    svg.insertBefore(createArrowDefs(), edgeGroup);

    for (const edge of edges) {
      edgeGroup.appendChild(renderEdgeSvg(edge, nodes, (id) => callbacks.onEdgeSelect(id)));
    }

    for (const node of nodes) {
      const g = renderNodeSvg(node, node.id === selectedNodeId);
      attachNodeDrag(g, node);
      nodeGroup.appendChild(g);
    }

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
