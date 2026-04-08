/** Contract: contracts/app/slides-interaction.md */

import { type Point, type BoundingBox, type HandlePosition, type ResizeState, MIN_ELEMENT_WIDTH, MIN_ELEMENT_HEIGHT } from './types.ts';

export type ResizeResult = {
  bounds: BoundingBox;
};

/** Start a resize operation */
export function startResize(
  elementBounds: BoundingBox,
  handle: HandlePosition,
  mousePercent: Point,
  shiftHeld: boolean,
): ResizeState {
  return {
    elementId: '',
    handle,
    startMousePercent: mousePercent,
    startBounds: { ...elementBounds },
    aspectRatio: elementBounds.width / Math.max(elementBounds.height, 0.01),
    shiftHeld,
  };
}

/** Calculate new bounds during a resize operation */
export function updateResize(
  state: ResizeState,
  currentMousePercent: Point,
  shiftHeld: boolean,
): ResizeResult {
  const dx = currentMousePercent.x - state.startMousePercent.x;
  const dy = currentMousePercent.y - state.startMousePercent.y;
  const s = state.startBounds;

  let x = s.x;
  let y = s.y;
  let width = s.width;
  let height = s.height;

  // Apply deltas based on which handle is being dragged
  switch (state.handle) {
    case 'top-left':
      x = s.x + dx;
      y = s.y + dy;
      width = s.width - dx;
      height = s.height - dy;
      break;
    case 'top-right':
      y = s.y + dy;
      width = s.width + dx;
      height = s.height - dy;
      break;
    case 'bottom-left':
      x = s.x + dx;
      width = s.width - dx;
      height = s.height + dy;
      break;
    case 'bottom-right':
      width = s.width + dx;
      height = s.height + dy;
      break;
    case 'top':
      y = s.y + dy;
      height = s.height - dy;
      break;
    case 'bottom':
      height = s.height + dy;
      break;
    case 'left':
      x = s.x + dx;
      width = s.width - dx;
      break;
    case 'right':
      width = s.width + dx;
      break;
  }

  // Enforce aspect ratio if Shift is held
  if (shiftHeld || state.shiftHeld) {
    const result = applyAspectRatio(state.handle, state.aspectRatio, x, y, width, height, s);
    x = result.x;
    y = result.y;
    width = result.width;
    height = result.height;
  }

  // Enforce minimum size
  width = Math.max(width, MIN_ELEMENT_WIDTH);
  height = Math.max(height, MIN_ELEMENT_HEIGHT);

  // Clamp to viewport
  x = Math.max(0, Math.min(x, 100 - MIN_ELEMENT_WIDTH));
  y = Math.max(0, Math.min(y, 100 - MIN_ELEMENT_HEIGHT));

  return { bounds: { x, y, width, height } };
}

/** Apply aspect ratio constraint based on the handle being dragged */
function applyAspectRatio(
  handle: HandlePosition,
  ratio: number,
  x: number,
  y: number,
  width: number,
  height: number,
  start: BoundingBox,
): BoundingBox {
  // For corner handles, use width as the driver
  const isCorner = handle.includes('-') || handle === 'top-left' || handle === 'top-right'
    || handle === 'bottom-left' || handle === 'bottom-right';
  const isHorizontal = handle === 'left' || handle === 'right';

  if (isCorner || isHorizontal) {
    height = width / ratio;
  } else {
    width = height * ratio;
  }

  // Anchor the opposite corner for corner handles
  if (handle === 'top-left') {
    x = start.x + start.width - width;
    y = start.y + start.height - height;
  } else if (handle === 'top-right') {
    y = start.y + start.height - height;
  } else if (handle === 'bottom-left') {
    x = start.x + start.width - width;
  }
  // bottom-right: x,y stay as-is (top-left corner is anchor)

  return { x, y, width, height };
}
