/** Contract: contracts/app/slides-interaction.md */

import type { BoundingBox, SlideElement, Point } from './types.ts';

export type SelectionState = {
  selectedIds: Set<string>;
};

export function createSelectionState(): SelectionState {
  return { selectedIds: new Set() };
}

/** Select a single element, replacing any existing selection */
export function selectSingle(state: SelectionState, elementId: string): SelectionState {
  return { selectedIds: new Set([elementId]) };
}

/** Toggle an element in/out of the selection (Shift+click) */
export function selectToggle(state: SelectionState, elementId: string): SelectionState {
  const next = new Set(state.selectedIds);
  if (next.has(elementId)) {
    next.delete(elementId);
  } else {
    next.add(elementId);
  }
  return { selectedIds: next };
}

/** Clear all selection */
export function selectNone(): SelectionState {
  return { selectedIds: new Set() };
}

/** Select all elements whose bounding boxes intersect the marquee rectangle */
export function selectByMarquee(
  elements: SlideElement[],
  marqueeStart: Point,
  marqueeEnd: Point,
): SelectionState {
  const marquee = normalizeRect(marqueeStart, marqueeEnd);
  const ids = new Set<string>();

  for (const el of elements) {
    const elBox: BoundingBox = { x: el.x, y: el.y, width: el.width, height: el.height };
    if (boxesIntersect(marquee, elBox)) {
      ids.add(el.id);
    }
  }

  return { selectedIds: ids };
}

/** Normalize two corner points into a proper BoundingBox (positive width/height) */
export function normalizeRect(a: Point, b: Point): BoundingBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/** Check if two axis-aligned bounding boxes intersect */
export function boxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Check if a point is inside a bounding box */
export function pointInBox(point: Point, box: BoundingBox): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}

/** Find the topmost element at a given point (last in array = topmost) */
export function elementAtPoint(elements: SlideElement[], point: Point): SlideElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    const box: BoundingBox = { x: el.x, y: el.y, width: el.width, height: el.height };
    if (pointInBox(point, box)) {
      return el;
    }
  }
  return null;
}
