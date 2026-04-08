/** Contract: contracts/app/slides-element-types.md */

import type { ShapeType, TableData, TextAlign } from './types.ts';
import { createDefaultTableData } from './render-table.ts';
import { TEXT_DEFAULTS } from './tiptap-mini-editor.ts';

type NewElementBase = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type NewTextElement = NewElementBase & {
  type: 'text';
  content: string;
  fontSize: number;
  fontColor: string;
  textAlign: TextAlign;
};

export type NewImageElement = NewElementBase & {
  type: 'image';
  content: string;
  src: string;
};

export type NewShapeElement = NewElementBase & {
  type: 'shape';
  content: string;
  fontSize: number;
  fontColor: string;
  textAlign: TextAlign;
  shapeType: ShapeType;
  fill: string;
  stroke: string;
  strokeWidth: number;
};

export type NewTableElement = NewElementBase & {
  type: 'table';
  content: string;
  tableData: TableData;
};

export type NewElement = NewTextElement | NewImageElement | NewShapeElement | NewTableElement;

function generateId(): string {
  return crypto.randomUUID();
}

/** Create a new text element with default dimensions */
export function createTextElement(): NewTextElement {
  return {
    id: generateId(),
    type: 'text',
    x: 20,
    y: 30,
    width: 60,
    height: 15,
    rotation: 0,
    content: '<p>Click to edit text</p>',
    fontSize: TEXT_DEFAULTS.fontSize,
    fontColor: TEXT_DEFAULTS.fontColor,
    textAlign: TEXT_DEFAULTS.textAlign,
  };
}

/** Create a new image element (src filled later after upload) */
export function createImageElement(src: string): NewImageElement {
  return {
    id: generateId(),
    type: 'image',
    x: 25,
    y: 15,
    width: 50,
    height: 50,
    rotation: 0,
    content: '',
    src,
  };
}

/** Create a new shape element */
export function createShapeElement(shapeType: ShapeType): NewShapeElement {
  const isLine = shapeType === 'line';
  return {
    id: generateId(),
    type: 'shape',
    x: 30,
    y: 30,
    width: isLine ? 40 : 30,
    height: isLine ? 5 : 30,
    rotation: 0,
    content: '',
    fontSize: TEXT_DEFAULTS.fontSize,
    fontColor: TEXT_DEFAULTS.fontColor,
    textAlign: 'center',
    shapeType,
    fill: isLine ? 'none' : '#4f87e0',
    stroke: '#2563eb',
    strokeWidth: 2,
  };
}

/** Create a new table element */
export function createTableElement(rows: number, cols: number): NewTableElement {
  return {
    id: generateId(),
    type: 'table',
    x: 15,
    y: 20,
    width: 70,
    height: 50,
    rotation: 0,
    content: '',
    tableData: createDefaultTableData(rows, cols),
  };
}
