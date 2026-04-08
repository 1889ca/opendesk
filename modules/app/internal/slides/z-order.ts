/** Contract: contracts/app/slides-interaction.md */

import type { SlideElement } from './types.ts';

/**
 * All z-order functions operate on plain arrays and return new arrays.
 * The caller is responsible for applying the result to the Yjs array.
 * Index 0 = backmost, last index = frontmost.
 */

/** Move an element one position toward the front (higher z-index) */
export function bringForward(elements: SlideElement[], elementId: string): SlideElement[] {
  const idx = elements.findIndex((el) => el.id === elementId);
  if (idx === -1 || idx === elements.length - 1) return elements;
  const result = [...elements];
  [result[idx], result[idx + 1]] = [result[idx + 1], result[idx]];
  return result;
}

/** Move an element one position toward the back (lower z-index) */
export function sendBackward(elements: SlideElement[], elementId: string): SlideElement[] {
  const idx = elements.findIndex((el) => el.id === elementId);
  if (idx <= 0) return elements;
  const result = [...elements];
  [result[idx], result[idx - 1]] = [result[idx - 1], result[idx]];
  return result;
}

/** Move an element to the very front (last position in array) */
export function bringToFront(elements: SlideElement[], elementId: string): SlideElement[] {
  const idx = elements.findIndex((el) => el.id === elementId);
  if (idx === -1 || idx === elements.length - 1) return elements;
  const result = [...elements];
  const [removed] = result.splice(idx, 1);
  result.push(removed);
  return result;
}

/** Move an element to the very back (first position in array) */
export function sendToBack(elements: SlideElement[], elementId: string): SlideElement[] {
  const idx = elements.findIndex((el) => el.id === elementId);
  if (idx <= 0) return elements;
  const result = [...elements];
  const [removed] = result.splice(idx, 1);
  result.unshift(removed);
  return result;
}

/** Move multiple elements to the front, preserving their relative order */
export function bringMultipleToFront(
  elements: SlideElement[],
  elementIds: Set<string>,
): SlideElement[] {
  const staying = elements.filter((el) => !elementIds.has(el.id));
  const moving = elements.filter((el) => elementIds.has(el.id));
  return [...staying, ...moving];
}

/** Move multiple elements to the back, preserving their relative order */
export function sendMultipleToBack(
  elements: SlideElement[],
  elementIds: Set<string>,
): SlideElement[] {
  const moving = elements.filter((el) => elementIds.has(el.id));
  const staying = elements.filter((el) => !elementIds.has(el.id));
  return [...moving, ...staying];
}
