/** Contract: contracts/app/slides-interaction.md */

import { type BoundingBox, type SnapGuide, type SnapResult, type SlideElement, GRID_SIZE, SNAP_THRESHOLD } from './types.ts';

/** Get the three key positions (start, center, end) for an axis */
function getEdges(box: BoundingBox): { hEdges: number[]; vEdges: number[] } {
  return {
    hEdges: [box.y, box.y + box.height / 2, box.y + box.height],
    vEdges: [box.x, box.x + box.width / 2, box.x + box.width],
  };
}

/** Snap a single value to the nearest grid line */
export function snapToGrid(value: number, gridSize: number = GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

/** Find the closest snap target within threshold, returns null if none */
function findClosestSnap(
  value: number,
  targets: number[],
  threshold: number = SNAP_THRESHOLD,
): { snapped: number; target: number } | null {
  let best: { snapped: number; target: number } | null = null;
  let bestDist = threshold;

  for (const target of targets) {
    const dist = Math.abs(value - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = { snapped: target, target };
    }
  }
  return best;
}

/** Collect snap targets from other elements (not the dragged one) */
function collectElementTargets(
  elements: SlideElement[],
  excludeIds: Set<string>,
): { hTargets: number[]; vTargets: number[] } {
  const hTargets: number[] = [];
  const vTargets: number[] = [];

  for (const el of elements) {
    if (excludeIds.has(el.id)) continue;
    const box: BoundingBox = { x: el.x, y: el.y, width: el.width, height: el.height };
    const { hEdges, vEdges } = getEdges(box);
    hTargets.push(...hEdges);
    vTargets.push(...vEdges);
  }

  // Canvas edges and center
  hTargets.push(0, 50, 100);
  vTargets.push(0, 50, 100);

  return { hTargets, vTargets };
}

/**
 * Calculate snapping for a moving bounding box against grid and other elements.
 * Returns the snapped position and any active guide lines.
 */
export function calculateSnap(
  movingBox: BoundingBox,
  elements: SlideElement[],
  excludeIds: string[],
  gridSize: number = GRID_SIZE,
): SnapResult {
  const excludeSet = new Set(excludeIds);
  const { hTargets, vTargets } = collectElementTargets(elements, excludeSet);
  const { hEdges, vEdges } = getEdges(movingBox);

  const guides: SnapGuide[] = [];
  let dx = 0;
  let dy = 0;

  // Try snapping each vertical edge of the moving box to targets
  let bestVSnap: { offset: number; target: number } | null = null;
  let bestVDist = SNAP_THRESHOLD;
  for (const edge of vEdges) {
    // Element snapping
    const snap = findClosestSnap(edge, vTargets);
    if (snap && Math.abs(snap.target - edge) < bestVDist) {
      bestVDist = Math.abs(snap.target - edge);
      bestVSnap = { offset: snap.target - edge, target: snap.target };
    }
    // Grid snapping (lower priority)
    const gridSnapped = snapToGrid(edge, gridSize);
    const gridDist = Math.abs(gridSnapped - edge);
    if (gridDist < bestVDist) {
      bestVDist = gridDist;
      bestVSnap = { offset: gridSnapped - edge, target: gridSnapped };
    }
  }
  if (bestVSnap) {
    dx = bestVSnap.offset;
    guides.push({ axis: 'vertical', position: bestVSnap.target });
  }

  // Try snapping each horizontal edge
  let bestHSnap: { offset: number; target: number } | null = null;
  let bestHDist = SNAP_THRESHOLD;
  for (const edge of hEdges) {
    const snap = findClosestSnap(edge, hTargets);
    if (snap && Math.abs(snap.target - edge) < bestHDist) {
      bestHDist = Math.abs(snap.target - edge);
      bestHSnap = { offset: snap.target - edge, target: snap.target };
    }
    const gridSnapped = snapToGrid(edge, gridSize);
    const gridDist = Math.abs(gridSnapped - edge);
    if (gridDist < bestHDist) {
      bestHDist = gridDist;
      bestHSnap = { offset: gridSnapped - edge, target: gridSnapped };
    }
  }
  if (bestHSnap) {
    dy = bestHSnap.offset;
    guides.push({ axis: 'horizontal', position: bestHSnap.target });
  }

  return {
    snappedX: movingBox.x + dx,
    snappedY: movingBox.y + dy,
    guides,
  };
}
