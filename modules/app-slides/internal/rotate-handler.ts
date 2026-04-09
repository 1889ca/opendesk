/** Contract: contracts/app-slides/rules.md */

import type { Point, RotateState } from './types.ts';

/**
 * Calculate the angle in degrees from a center point to a mouse position.
 * 0 degrees = up (12 o'clock), increases clockwise.
 */
export function angleFromCenter(center: Point, mouse: Point): number {
  const dx = mouse.x - center.x;
  const dy = mouse.y - center.y;
  // atan2 gives angle from positive X axis, counterclockwise
  // We want angle from positive Y axis (up), clockwise
  const radians = Math.atan2(dx, -dy);
  let degrees = radians * (180 / Math.PI);
  if (degrees < 0) degrees += 360;
  return degrees;
}

/** Start a rotation operation */
export function startRotate(
  elementCenter: Point,
  mousePercent: Point,
  currentRotation: number,
): RotateState {
  return {
    elementId: '',
    centerPercent: elementCenter,
    startAngle: angleFromCenter(elementCenter, mousePercent),
    startRotation: currentRotation,
  };
}

/** Calculate new rotation during a rotate operation */
export function updateRotate(state: RotateState, currentMousePercent: Point): number {
  const currentAngle = angleFromCenter(state.centerPercent, currentMousePercent);
  let delta = currentAngle - state.startAngle;
  // Normalize to -180..180
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return normalizeAngle(state.startRotation + delta);
}

/** Snap rotation to 15-degree increments when Shift is held */
export function snapRotation(degrees: number): number {
  const snap = 15;
  return Math.round(degrees / snap) * snap;
}

/** Normalize angle to 0-360 range */
export function normalizeAngle(degrees: number): number {
  let result = degrees % 360;
  if (result < 0) result += 360;
  return result === 0 ? 0 : result; // avoid -0
}

/** Get the center point of a bounding box */
export function getElementCenter(x: number, y: number, width: number, height: number): Point {
  return {
    x: x + width / 2,
    y: y + height / 2,
  };
}
