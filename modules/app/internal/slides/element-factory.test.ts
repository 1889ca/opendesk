/** Contract: contracts/app/slides-element-types.md */

import { describe, it, expect } from 'vitest';
import {
  createTextElement,
  createImageElement,
  createShapeElement,
  createTableElement,
} from './element-factory.ts';

describe('createTextElement', () => {
  it('returns a text element with a UUID id', () => {
    const el = createTextElement();
    expect(el.type).toBe('text');
    expect(el.id).toMatch(/^[0-9a-f]{8}-/);
    expect(el.content).toBe('Click to edit text');
    expect(el.width).toBeGreaterThan(0);
    expect(el.height).toBeGreaterThan(0);
  });

  it('produces unique IDs on each call', () => {
    const a = createTextElement();
    const b = createTextElement();
    expect(a.id).not.toBe(b.id);
  });
});

describe('createImageElement', () => {
  it('stores the src URL', () => {
    const el = createImageElement('https://example.com/photo.png');
    expect(el.type).toBe('image');
    expect(el.src).toBe('https://example.com/photo.png');
  });
});

describe('createShapeElement', () => {
  it('creates a rectangle shape', () => {
    const el = createShapeElement('rectangle');
    expect(el.type).toBe('shape');
    expect(el.shapeType).toBe('rectangle');
    expect(el.fill).toBeTruthy();
    expect(el.stroke).toBeTruthy();
    expect(el.strokeWidth).toBeGreaterThan(0);
  });

  it('creates a line with different default dimensions', () => {
    const line = createShapeElement('line');
    const rect = createShapeElement('rectangle');
    expect(line.shapeType).toBe('line');
    expect(line.fill).toBe('none');
    expect(line.width).toBeGreaterThan(rect.width);
    expect(line.height).toBeLessThan(rect.height);
  });

  it('supports all shape types', () => {
    const types = ['rectangle', 'rounded-rect', 'ellipse', 'triangle', 'arrow', 'line'] as const;
    for (const t of types) {
      const el = createShapeElement(t);
      expect(el.shapeType).toBe(t);
    }
  });
});

describe('createTableElement', () => {
  it('creates a table with correct dimensions', () => {
    const el = createTableElement(4, 5);
    expect(el.type).toBe('table');
    expect(el.tableData.rows).toBe(4);
    expect(el.tableData.cols).toBe(5);
    expect(el.tableData.cells).toHaveLength(4);
    expect(el.tableData.cells[0]).toHaveLength(5);
  });

  it('initializes all cells as empty strings', () => {
    const el = createTableElement(2, 3);
    for (const row of el.tableData.cells) {
      for (const cell of row) {
        expect(cell).toBe('');
      }
    }
  });
});
