/** Contract: contracts/app/slides-interaction.md */

import { type Point, type SlideElement, type DragState, type BoundingBox, type SnapGuide } from './types.ts';
import { calculateSnap } from './snap-engine.ts';

export type DragResult = {
  updates: Map<string, Point>;
  guides: SnapGuide[];
};

/** Start a drag operation, capturing initial positions of all dragged elements */
export function startDrag(
  elements: SlideElement[],
  selectedIds: string[],
  mousePercent: Point,
): DragState {
  const startPositions = new Map<string, Point>();
  for (const el of elements) {
    if (selectedIds.includes(el.id)) {
      startPositions.set(el.id, { x: el.x, y: el.y });
    }
  }
  return {
    elementIds: selectedIds,
    startMousePercent: mousePercent,
    startPositions,
  };
}

/** Calculate new positions during a drag, applying snap logic */
export function updateDrag(
  dragState: DragState,
  currentMousePercent: Point,
  allElements: SlideElement[],
): DragResult {
  const dx = currentMousePercent.x - dragState.startMousePercent.x;
  const dy = currentMousePercent.y - dragState.startMousePercent.y;

  const updates = new Map<string, Point>();
  let guides: SnapGuide[] = [];

  // Use the first element as the snap reference
  const primaryId = dragState.elementIds[0];
  const primaryStart = dragState.startPositions.get(primaryId);
  if (!primaryStart) return { updates, guides };

  const primaryEl = allElements.find((el) => el.id === primaryId);
  if (!primaryEl) return { updates, guides };

  // Calculate raw new position for the primary element
  const rawBox: BoundingBox = {
    x: primaryStart.x + dx,
    y: primaryStart.y + dy,
    width: primaryEl.width,
    height: primaryEl.height,
  };

  // Snap the primary element
  const snapResult = calculateSnap(rawBox, allElements, dragState.elementIds);
  const snapDx = snapResult.snappedX - rawBox.x;
  const snapDy = snapResult.snappedY - rawBox.y;
  guides = snapResult.guides;

  // Apply the same offset to all dragged elements
  for (const id of dragState.elementIds) {
    const start = dragState.startPositions.get(id);
    if (!start) continue;
    updates.set(id, {
      x: clampPercent(start.x + dx + snapDx),
      y: clampPercent(start.y + dy + snapDy),
    });
  }

  return { updates, guides };
}

/** Clamp a percentage value to valid range */
function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Apply keyboard nudge to selected elements */
export function nudgeElements(
  elements: SlideElement[],
  selectedIds: string[],
  direction: 'up' | 'down' | 'left' | 'right',
  amount: number,
): Map<string, Point> {
  const updates = new Map<string, Point>();
  const delta = { x: 0, y: 0 };

  switch (direction) {
    case 'up':
      delta.y = -amount;
      break;
    case 'down':
      delta.y = amount;
      break;
    case 'left':
      delta.x = -amount;
      break;
    case 'right':
      delta.x = amount;
      break;
  }

  for (const el of elements) {
    if (selectedIds.includes(el.id)) {
      updates.set(el.id, {
        x: clampPercent(el.x + delta.x),
        y: clampPercent(el.y + delta.y),
      });
    }
  }

  return updates;
}
