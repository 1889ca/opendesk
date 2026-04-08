/** Contract: contracts/app/slides-element-types.md */

import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { parseSlideElements } from './parse-elements.ts';

function createYElement(props: Record<string, unknown>): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(props)) {
    m.set(k, v);
  }
  return m;
}

describe('parseSlideElements', () => {
  it('parses text elements', () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>('test');
    doc.transact(() => {
      arr.push([createYElement({
        id: 'aaa-bbb-ccc', type: 'text', x: 10, y: 20, width: 50, height: 30,
        rotation: 0, content: 'Hello',
      })]);
    });
    const elements = parseSlideElements(arr);
    expect(elements).toHaveLength(1);
    expect(elements[0].type).toBe('text');
    expect(elements[0].content).toBe('Hello');
  });

  it('parses image elements with src', () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>('test');
    doc.transact(() => {
      arr.push([createYElement({
        id: 'img-1', type: 'image', x: 0, y: 0, width: 40, height: 40,
        rotation: 0, content: '', src: 'https://example.com/img.png',
      })]);
    });
    const elements = parseSlideElements(arr);
    expect(elements[0].type).toBe('image');
    expect(elements[0].src).toBe('https://example.com/img.png');
  });

  it('parses shape elements with shape properties', () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>('test');
    doc.transact(() => {
      arr.push([createYElement({
        id: 'shape-1', type: 'shape', x: 5, y: 5, width: 20, height: 20,
        rotation: 45, content: '', shapeType: 'ellipse', fill: '#ff0000',
        stroke: '#000', strokeWidth: 3,
      })]);
    });
    const elements = parseSlideElements(arr);
    expect(elements[0].type).toBe('shape');
    expect(elements[0].shapeType).toBe('ellipse');
    expect(elements[0].fill).toBe('#ff0000');
    expect(elements[0].stroke).toBe('#000');
    expect(elements[0].strokeWidth).toBe(3);
    expect(elements[0].rotation).toBe(45);
  });

  it('parses table elements with table data', () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>('test');
    const tableData = JSON.stringify({ rows: 2, cols: 2, cells: [['A', 'B'], ['C', 'D']] });
    doc.transact(() => {
      arr.push([createYElement({
        id: 'tbl-1', type: 'table', x: 10, y: 10, width: 60, height: 40,
        rotation: 0, content: '', tableData,
      })]);
    });
    const elements = parseSlideElements(arr);
    expect(elements[0].type).toBe('table');
    expect(elements[0].tableData).toBeDefined();
    expect(elements[0].tableData!.rows).toBe(2);
    expect(elements[0].tableData!.cols).toBe(2);
    expect(elements[0].tableData!.cells[0][0]).toBe('A');
    expect(elements[0].tableData!.cells[1][1]).toBe('D');
  });

  it('handles missing optional fields with defaults', () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>('test');
    doc.transact(() => {
      arr.push([createYElement({ id: 'min-1', type: 'shape' })]);
    });
    const elements = parseSlideElements(arr);
    expect(elements[0].shapeType).toBe('rectangle');
    expect(elements[0].fill).toBe('#4f87e0');
    expect(elements[0].stroke).toBe('#2563eb');
    expect(elements[0].strokeWidth).toBe(2);
  });
});
