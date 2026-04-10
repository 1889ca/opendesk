/** Contract: contracts/app-slides/rules.md */

import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import {
  applyPositionUpdates,
  applyBoundsUpdate,
  applyRotationUpdate,
  deleteElements,
  applyFieldUpdate,
  applyZOrderToYjs,
  type YjsElementAccessor,
} from './yjs-mutations.ts';
import type { SlideElement } from './types.ts';

function makeYElement(id: string, x = 0, y = 0): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  m.set('id', id);
  m.set('x', x);
  m.set('y', y);
  m.set('width', 10);
  m.set('height', 10);
  m.set('rotation', 0);
  return m;
}

function setupDoc(ids: string[]): { ydoc: Y.Doc; accessor: YjsElementAccessor } {
  const ydoc = new Y.Doc();
  const yElements = ydoc.getArray<Y.Map<unknown>>('elements');
  ydoc.transact(() => {
    for (const id of ids) {
      yElements.push([makeYElement(id)]);
    }
  });
  return { ydoc, accessor: { yElements } };
}

function toSlideEl(id: string): SlideElement {
  return { id, type: 'shape', x: 0, y: 0, width: 10, height: 10, rotation: 0, content: '' };
}

describe('applyPositionUpdates', () => {
  it('updates x/y for matching elements', () => {
    const { ydoc, accessor } = setupDoc(['a', 'b']);
    const updates = new Map([['a', { x: 50, y: 75 }]]);
    applyPositionUpdates(ydoc, accessor, updates);
    const yel = accessor.yElements.get(0);
    expect(yel.get('x')).toBe(50);
    expect(yel.get('y')).toBe(75);
  });

  it('does not modify elements not in the update map', () => {
    const { ydoc, accessor } = setupDoc(['a', 'b']);
    const updates = new Map([['a', { x: 10, y: 20 }]]);
    applyPositionUpdates(ydoc, accessor, updates);
    const yelB = accessor.yElements.get(1);
    expect(yelB.get('x')).toBe(0);
    expect(yelB.get('y')).toBe(0);
  });

  it('handles empty update map (no-op)', () => {
    const { ydoc, accessor } = setupDoc(['a']);
    applyPositionUpdates(ydoc, accessor, new Map());
    expect(accessor.yElements.get(0).get('x')).toBe(0);
  });

  it('updates multiple elements in a single transaction', () => {
    const { ydoc, accessor } = setupDoc(['a', 'b', 'c']);
    const updates = new Map([
      ['a', { x: 1, y: 2 }],
      ['c', { x: 3, y: 4 }],
    ]);
    applyPositionUpdates(ydoc, accessor, updates);
    expect(accessor.yElements.get(0).get('x')).toBe(1);
    expect(accessor.yElements.get(2).get('x')).toBe(3);
  });
});

describe('applyBoundsUpdate', () => {
  it('sets x, y, width, height on the target element', () => {
    const { ydoc, accessor } = setupDoc(['a', 'b']);
    applyBoundsUpdate(ydoc, accessor, 'a', { x: 5, y: 10, width: 40, height: 30 });
    const yel = accessor.yElements.get(0);
    expect(yel.get('x')).toBe(5);
    expect(yel.get('y')).toBe(10);
    expect(yel.get('width')).toBe(40);
    expect(yel.get('height')).toBe(30);
  });

  it('does not modify other elements', () => {
    const { ydoc, accessor } = setupDoc(['a', 'b']);
    applyBoundsUpdate(ydoc, accessor, 'a', { x: 5, y: 10, width: 40, height: 30 });
    const yelB = accessor.yElements.get(1);
    expect(yelB.get('x')).toBe(0);
    expect(yelB.get('width')).toBe(10);
  });

  it('is a no-op for unknown element id', () => {
    const { ydoc, accessor } = setupDoc(['a']);
    applyBoundsUpdate(ydoc, accessor, 'z', { x: 99, y: 99, width: 99, height: 99 });
    expect(accessor.yElements.get(0).get('x')).toBe(0);
  });
});

describe('applyRotationUpdate', () => {
  it('sets rotation on the target element', () => {
    const { ydoc, accessor } = setupDoc(['a', 'b']);
    applyRotationUpdate(ydoc, accessor, 'b', 45);
    expect(accessor.yElements.get(1).get('rotation')).toBe(45);
  });

  it('does not affect other elements', () => {
    const { ydoc, accessor } = setupDoc(['a', 'b']);
    applyRotationUpdate(ydoc, accessor, 'b', 90);
    expect(accessor.yElements.get(0).get('rotation')).toBe(0);
  });

  it('handles negative rotation values', () => {
    const { ydoc, accessor } = setupDoc(['a']);
    applyRotationUpdate(ydoc, accessor, 'a', -30);
    expect(accessor.yElements.get(0).get('rotation')).toBe(-30);
  });
});

describe('deleteElements', () => {
  it('removes matching elements from the array', () => {
    const { ydoc, accessor } = setupDoc(['a', 'b', 'c']);
    deleteElements(ydoc, accessor, new Set(['b']));
    expect(accessor.yElements.length).toBe(2);
    const ids = [0, 1].map((i) => accessor.yElements.get(i).get('id'));
    expect(ids).toContain('a');
    expect(ids).toContain('c');
    expect(ids).not.toContain('b');
  });

  it('removes multiple elements', () => {
    const { ydoc, accessor } = setupDoc(['a', 'b', 'c', 'd']);
    deleteElements(ydoc, accessor, new Set(['a', 'c']));
    expect(accessor.yElements.length).toBe(2);
    const ids = [0, 1].map((i) => accessor.yElements.get(i).get('id'));
    expect(ids).toEqual(['b', 'd']);
  });

  it('is a no-op for empty id set', () => {
    const { ydoc, accessor } = setupDoc(['a', 'b']);
    deleteElements(ydoc, accessor, new Set());
    expect(accessor.yElements.length).toBe(2);
  });

  it('handles unknown ids gracefully', () => {
    const { ydoc, accessor } = setupDoc(['a', 'b']);
    deleteElements(ydoc, accessor, new Set(['z']));
    expect(accessor.yElements.length).toBe(2);
  });
});

describe('applyFieldUpdate', () => {
  it('sets an arbitrary field on the target element', () => {
    const { ydoc, accessor } = setupDoc(['a']);
    applyFieldUpdate(ydoc, accessor, 'a', 'fill', '#ff0000');
    expect(accessor.yElements.get(0).get('fill')).toBe('#ff0000');
  });

  it('does not affect other elements', () => {
    const { ydoc, accessor } = setupDoc(['a', 'b']);
    applyFieldUpdate(ydoc, accessor, 'a', 'fill', '#ff0000');
    expect(accessor.yElements.get(1).get('fill')).toBeUndefined();
  });
});

describe('applyZOrderToYjs', () => {
  it('reorders elements to match the given array', () => {
    const { ydoc, accessor } = setupDoc(['a', 'b', 'c']);
    const reordered: SlideElement[] = ['c', 'a', 'b'].map(toSlideEl);
    applyZOrderToYjs(ydoc, accessor, reordered);
    const ids = [0, 1, 2].map((i) => accessor.yElements.get(i).get('id'));
    expect(ids).toEqual(['c', 'a', 'b']);
  });

  it('preserves element data after reorder', () => {
    const { ydoc, accessor } = setupDoc(['a', 'b']);
    // Give 'a' a distinct value to verify it survives the reorder
    accessor.yElements.get(0).set('width', 99);
    const reordered: SlideElement[] = ['b', 'a'].map(toSlideEl);
    applyZOrderToYjs(ydoc, accessor, reordered);
    const aMap = accessor.yElements.get(1);
    expect(aMap.get('id')).toBe('a');
    expect(aMap.get('width')).toBe(99);
  });

  it('handles a single element (no-op effectively)', () => {
    const { ydoc, accessor } = setupDoc(['a']);
    applyZOrderToYjs(ydoc, accessor, [toSlideEl('a')]);
    expect(accessor.yElements.length).toBe(1);
    expect(accessor.yElements.get(0).get('id')).toBe('a');
  });

  it('skips elements in reordered list that are not in Yjs', () => {
    const { ydoc, accessor } = setupDoc(['a', 'b']);
    // 'z' is not in yElements — should be skipped
    const reordered: SlideElement[] = ['b', 'a', 'z'].map(toSlideEl);
    applyZOrderToYjs(ydoc, accessor, reordered);
    expect(accessor.yElements.length).toBe(2);
    expect(accessor.yElements.get(0).get('id')).toBe('b');
    expect(accessor.yElements.get(1).get('id')).toBe('a');
  });
});
