/** Contract: contracts/app-slides/rules.md */

import * as Y from 'yjs';
import type { NewElement } from './element-factory.ts';
import type { TableData } from './types.ts';
import { MAX_TABLE_ROWS, MAX_TABLE_COLS } from '../contract.ts';

/** Invariant 11: only http(s) or /uploads/ relative paths are permitted */
function isSafeSrc(src: string): boolean {
  return /^https?:\/\//.test(src) || src.startsWith('/uploads/');
}

/** Invariant 13: clamp table dimensions before persisting */
function clampTableData(data: TableData): TableData {
  const rows = Math.min(data.rows, MAX_TABLE_ROWS);
  const cols = Math.min(data.cols, MAX_TABLE_COLS);
  const cells = data.cells.slice(0, rows).map((row) =>
    row.slice(0, cols).map((cell) => cell.slice(0, 8192))
  );
  return { rows, cols, cells };
}

/** Insert a new element into the Yjs slide elements array */
export function insertElement(
  ydoc: Y.Doc,
  yElements: Y.Array<Y.Map<unknown>>,
  element: NewElement,
): void {
  ydoc.transact(() => {
    const yel = new Y.Map<unknown>();
    yel.set('id', element.id);
    yel.set('type', element.type);
    yel.set('x', element.x);
    yel.set('y', element.y);
    yel.set('width', element.width);
    yel.set('height', element.height);
    yel.set('rotation', element.rotation);
    yel.set('content', element.content);

    if (element.type === 'text') {
      yel.set('fontSize', element.fontSize);
      yel.set('fontColor', element.fontColor);
      yel.set('textAlign', element.textAlign);
    } else if (element.type === 'image') {
      // Invariant 11: reject unsafe src schemes before storing
      if (element.src && !isSafeSrc(element.src)) {
        throw new Error(`Rejected unsafe image src scheme: ${element.src.slice(0, 64)}`);
      }
      yel.set('src', element.src);
    } else if (element.type === 'shape') {
      yel.set('fontSize', element.fontSize);
      yel.set('fontColor', element.fontColor);
      yel.set('textAlign', element.textAlign);
      yel.set('shapeType', element.shapeType);
      yel.set('fill', element.fill);
      yel.set('stroke', element.stroke);
      yel.set('strokeWidth', element.strokeWidth);
    } else if (element.type === 'table') {
      // Invariant 13: clamp dimensions before persisting
      yel.set('tableData', serializeTableData(clampTableData(element.tableData)));
    }

    yElements.push([yel]);
  });
}

/** Update a single table cell in Yjs */
export function updateTableCell(
  ydoc: Y.Doc,
  yElements: Y.Array<Y.Map<unknown>>,
  elementId: string,
  row: number,
  col: number,
  value: string,
): void {
  ydoc.transact(() => {
    for (let i = 0; i < yElements.length; i++) {
      const yel = yElements.get(i);
      if (yel.get('id') !== elementId) continue;

      const rawData = yel.get('tableData') as string | undefined;
      if (!rawData) break;

      const tableData = parseTableData(rawData);
      if (!tableData) break;

      if (tableData.cells[row]) {
        tableData.cells[row][col] = value;
        yel.set('tableData', serializeTableData(tableData));
      }
      break;
    }
  });
}

function serializeTableData(data: TableData): string {
  return JSON.stringify(data);
}

export function parseTableData(raw: unknown): TableData | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.rows !== 'number' || typeof parsed.cols !== 'number') return null;
    if (!Array.isArray(parsed.cells)) return null;
    return clampTableData(parsed as TableData);
  } catch {
    return null;
  }
}
