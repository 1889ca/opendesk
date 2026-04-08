/** Contract: contracts/app/slides-interaction.md */

import * as Y from 'yjs';
import type { Point, SlideElement } from './types.ts';

export type YjsElementAccessor = {
  yElements: Y.Array<Y.Map<unknown>>;
};

/** Apply position updates to Yjs elements within a transaction */
export function applyPositionUpdates(
  ydoc: Y.Doc,
  accessor: YjsElementAccessor,
  updates: Map<string, Point>,
): void {
  const { yElements } = accessor;
  ydoc.transact(() => {
    for (let i = 0; i < yElements.length; i++) {
      const yel = yElements.get(i);
      const id = yel.get('id') as string;
      const pos = updates.get(id);
      if (pos) {
        yel.set('x', pos.x);
        yel.set('y', pos.y);
      }
    }
  });
}

/** Apply bounds (position + size) update to a single Yjs element */
export function applyBoundsUpdate(
  ydoc: Y.Doc,
  accessor: YjsElementAccessor,
  elementId: string,
  bounds: { x: number; y: number; width: number; height: number },
): void {
  const { yElements } = accessor;
  ydoc.transact(() => {
    for (let i = 0; i < yElements.length; i++) {
      const yel = yElements.get(i);
      if (yel.get('id') === elementId) {
        yel.set('x', bounds.x);
        yel.set('y', bounds.y);
        yel.set('width', bounds.width);
        yel.set('height', bounds.height);
        break;
      }
    }
  });
}

/** Apply rotation update to a single Yjs element */
export function applyRotationUpdate(
  ydoc: Y.Doc,
  accessor: YjsElementAccessor,
  elementId: string,
  angle: number,
): void {
  const { yElements } = accessor;
  ydoc.transact(() => {
    for (let i = 0; i < yElements.length; i++) {
      const yel = yElements.get(i);
      if (yel.get('id') === elementId) {
        yel.set('rotation', angle);
        break;
      }
    }
  });
}

/** Delete elements by IDs from Yjs array */
export function deleteElements(
  ydoc: Y.Doc,
  accessor: YjsElementAccessor,
  ids: Set<string>,
): void {
  const { yElements } = accessor;
  ydoc.transact(() => {
    for (let i = yElements.length - 1; i >= 0; i--) {
      const yel = yElements.get(i);
      if (ids.has(yel.get('id') as string)) {
        yElements.delete(i, 1);
      }
    }
  });
}

/** Update a single field on a Yjs element */
export function applyFieldUpdate(
  ydoc: Y.Doc,
  accessor: YjsElementAccessor,
  elementId: string,
  field: string,
  value: unknown,
): void {
  const { yElements } = accessor;
  ydoc.transact(() => {
    for (let i = 0; i < yElements.length; i++) {
      const yel = yElements.get(i);
      if (yel.get('id') === elementId) {
        yel.set(field, value);
        break;
      }
    }
  });
}

/** Reorder Yjs elements to match a new ordering */
export function applyZOrderToYjs(
  ydoc: Y.Doc,
  accessor: YjsElementAccessor,
  reorderedElements: SlideElement[],
): void {
  const { yElements } = accessor;
  ydoc.transact(() => {
    const maps: Y.Map<unknown>[] = [];
    for (let i = 0; i < yElements.length; i++) maps.push(yElements.get(i));
    const idToMap = new Map(maps.map((m) => [m.get('id') as string, m]));
    yElements.delete(0, yElements.length);
    for (const el of reorderedElements) {
      const m = idToMap.get(el.id);
      if (m) yElements.push([m]);
    }
  });
}
