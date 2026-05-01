/** Contract: contracts/app-slides/rules.md */

import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { insertElement, updateTableCell, parseTableData } from './yjs-element-insert.ts';
import { createTextElement, createImageElement, createShapeElement, createTableElement } from './element-factory.ts';

function setupYElements(): { ydoc: Y.Doc; yElements: Y.Array<Y.Map<unknown>> } {
  const ydoc = new Y.Doc();
  const yElements = ydoc.getArray<Y.Map<unknown>>('elements');
  return { ydoc, yElements };
}

describe('insertElement', () => {
  it('inserts a text element into Yjs', () => {
    const { ydoc, yElements } = setupYElements();
    insertElement(ydoc, yElements, createTextElement());
    expect(yElements.length).toBe(1);
    expect(yElements.get(0).get('type')).toBe('text');
  });

  it('inserts an image element with src', () => {
    const { ydoc, yElements } = setupYElements();
    insertElement(ydoc, yElements, createImageElement('https://example.com/pic.jpg'));
    const yel = yElements.get(0);
    expect(yel.get('type')).toBe('image');
    expect(yel.get('src')).toBe('https://example.com/pic.jpg');
  });

  it('inserts a shape element with shape properties', () => {
    const { ydoc, yElements } = setupYElements();
    insertElement(ydoc, yElements, createShapeElement('triangle'));
    const yel = yElements.get(0);
    expect(yel.get('type')).toBe('shape');
    expect(yel.get('shapeType')).toBe('triangle');
    expect(yel.get('fill')).toBeTruthy();
    expect(yel.get('stroke')).toBeTruthy();
  });

  it('inserts a table element with serialized table data', () => {
    const { ydoc, yElements } = setupYElements();
    insertElement(ydoc, yElements, createTableElement(3, 4));
    const yel = yElements.get(0);
    expect(yel.get('type')).toBe('table');
    const rawData = yel.get('tableData') as string;
    const parsed = parseTableData(rawData);
    expect(parsed).not.toBeNull();
    expect(parsed!.rows).toBe(3);
    expect(parsed!.cols).toBe(4);
  });

  it('appends elements in order', () => {
    const { ydoc, yElements } = setupYElements();
    insertElement(ydoc, yElements, createTextElement());
    insertElement(ydoc, yElements, createShapeElement('ellipse'));
    expect(yElements.length).toBe(2);
    expect(yElements.get(0).get('type')).toBe('text');
    expect(yElements.get(1).get('type')).toBe('shape');
  });
});

describe('updateTableCell', () => {
  it('updates a specific cell value', () => {
    const { ydoc, yElements } = setupYElements();
    insertElement(ydoc, yElements, createTableElement(2, 2));
    const id = yElements.get(0).get('id') as string;

    updateTableCell(ydoc, yElements, id, 0, 1, 'Hello');
    const raw = yElements.get(0).get('tableData') as string;
    const parsed = parseTableData(raw);
    expect(parsed!.cells[0][1]).toBe('Hello');
  });

  it('preserves other cell values when updating one', () => {
    const { ydoc, yElements } = setupYElements();
    insertElement(ydoc, yElements, createTableElement(2, 2));
    const id = yElements.get(0).get('id') as string;

    updateTableCell(ydoc, yElements, id, 0, 0, 'A');
    updateTableCell(ydoc, yElements, id, 1, 1, 'D');
    const raw = yElements.get(0).get('tableData') as string;
    const parsed = parseTableData(raw);
    expect(parsed!.cells[0][0]).toBe('A');
    expect(parsed!.cells[1][1]).toBe('D');
    expect(parsed!.cells[0][1]).toBe('');
  });
});

// Security: #503 image src validation on insert (invariant 11)
describe('insertElement image src validation', () => {
  it('throws when inserting an image with javascript: src', () => {
    const { ydoc, yElements } = setupYElements();
    const el = createImageElement('javascript:alert(1)');
    expect(() => insertElement(ydoc, yElements, el)).toThrow(/unsafe/i);
    expect(yElements.length).toBe(0);
  });

  it('throws when inserting an image with data: src', () => {
    const { ydoc, yElements } = setupYElements();
    const el = createImageElement('data:image/png;base64,abc123');
    expect(() => insertElement(ydoc, yElements, el)).toThrow(/unsafe/i);
  });

  it('throws when inserting an image with blob: src', () => {
    const { ydoc, yElements } = setupYElements();
    const el = createImageElement('blob:https://evil.com/abc');
    expect(() => insertElement(ydoc, yElements, el)).toThrow(/unsafe/i);
  });

  it('allows inserting https src', () => {
    const { ydoc, yElements } = setupYElements();
    expect(() => insertElement(ydoc, yElements, createImageElement('https://cdn.example.com/photo.jpg'))).not.toThrow();
    expect(yElements.length).toBe(1);
  });

  it('allows inserting /uploads/ relative src', () => {
    const { ydoc, yElements } = setupYElements();
    expect(() => insertElement(ydoc, yElements, createImageElement('/uploads/user-img.png'))).not.toThrow();
    expect(yElements.length).toBe(1);
  });
});

// Security: #505 table bounds clamping on insert (invariant 13)
describe('insertElement table bounds clamping', () => {
  it('clamps oversized table dimensions on insert', () => {
    const { ydoc, yElements } = setupYElements();
    const oversize = createTableElement(999, 999);
    insertElement(ydoc, yElements, oversize);
    const raw = yElements.get(0).get('tableData') as string;
    const parsed = parseTableData(raw);
    expect(parsed!.rows).toBeLessThanOrEqual(50);
    expect(parsed!.cols).toBeLessThanOrEqual(20);
  });
});

describe('parseTableData', () => {
  it('parses valid JSON table data', () => {
    const raw = JSON.stringify({ rows: 2, cols: 3, cells: [['a', 'b', 'c'], ['d', 'e', 'f']] });
    const result = parseTableData(raw);
    expect(result).not.toBeNull();
    expect(result!.rows).toBe(2);
    expect(result!.cols).toBe(3);
  });

  it('returns null for invalid JSON', () => {
    expect(parseTableData('not json')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(parseTableData(42)).toBeNull();
    expect(parseTableData(null)).toBeNull();
  });

  it('returns null for missing required fields', () => {
    expect(parseTableData(JSON.stringify({ rows: 2 }))).toBeNull();
    expect(parseTableData(JSON.stringify({ cols: 2 }))).toBeNull();
    expect(parseTableData(JSON.stringify({ rows: 2, cols: 2 }))).toBeNull();
  });
});
