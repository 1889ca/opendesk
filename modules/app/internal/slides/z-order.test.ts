/** Contract: contracts/app/slides-interaction.md */

import { describe, it, expect } from 'vitest';
import {
  bringForward, sendBackward, bringToFront, sendToBack,
  bringMultipleToFront, sendMultipleToBack,
} from './z-order.ts';
import type { SlideElement } from './types.ts';

function el(id: string): SlideElement {
  return { id, type: 'shape', x: 0, y: 0, width: 10, height: 10, rotation: 0, content: '' };
}

const elements = [el('a'), el('b'), el('c'), el('d')];

describe('bringForward', () => {
  it('moves element one position forward', () => {
    const result = bringForward(elements, 'b');
    expect(result.map((e) => e.id)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('does nothing if already at front', () => {
    const result = bringForward(elements, 'd');
    expect(result.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does nothing for unknown element', () => {
    const result = bringForward(elements, 'unknown');
    expect(result.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('sendBackward', () => {
  it('moves element one position backward', () => {
    const result = sendBackward(elements, 'c');
    expect(result.map((e) => e.id)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('does nothing if already at back', () => {
    const result = sendBackward(elements, 'a');
    expect(result.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('bringToFront', () => {
  it('moves element to the very front', () => {
    const result = bringToFront(elements, 'a');
    expect(result.map((e) => e.id)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('does nothing if already at front', () => {
    const result = bringToFront(elements, 'd');
    expect(result.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('sendToBack', () => {
  it('moves element to the very back', () => {
    const result = sendToBack(elements, 'd');
    expect(result.map((e) => e.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('does nothing if already at back', () => {
    const result = sendToBack(elements, 'a');
    expect(result.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('bringMultipleToFront', () => {
  it('moves multiple elements to front preserving relative order', () => {
    const result = bringMultipleToFront(elements, new Set(['a', 'c']));
    expect(result.map((e) => e.id)).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('sendMultipleToBack', () => {
  it('moves multiple elements to back preserving relative order', () => {
    const result = sendMultipleToBack(elements, new Set(['b', 'd']));
    expect(result.map((e) => e.id)).toEqual(['b', 'd', 'a', 'c']);
  });
});
