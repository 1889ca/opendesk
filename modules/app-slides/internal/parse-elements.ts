/** Contract: contracts/app-slides/rules.md */

import * as Y from 'yjs';
import type { SlideElement, ShapeType, TableData } from './types.ts';
import { parseTableData } from './yjs-element-insert.ts';

/** Parse Yjs element maps into typed SlideElement objects */
export function parseSlideElements(yElements: Y.Array<Y.Map<unknown>>): SlideElement[] {
  const result: SlideElement[] = [];
  for (let i = 0; i < yElements.length; i++) {
    const el = yElements.get(i);
    const type = (el.get('type') as string) || 'text';
    const base = {
      id: el.get('id') as string,
      type: type as SlideElement['type'],
      x: (el.get('x') as number) || 0,
      y: (el.get('y') as number) || 0,
      width: (el.get('width') as number) || 50,
      height: (el.get('height') as number) || 20,
      rotation: (el.get('rotation') as number) || 0,
      content: (el.get('content') as string) || '',
      fontSize: el.get('fontSize') as number | undefined,
      fontColor: el.get('fontColor') as string | undefined,
      textAlign: el.get('textAlign') as SlideElement['textAlign'],
    };

    if (type === 'image') {
      result.push({ ...base, src: (el.get('src') as string) || '' });
    } else if (type === 'shape') {
      result.push({
        ...base,
        shapeType: (el.get('shapeType') as ShapeType) || 'rectangle',
        fill: (el.get('fill') as string) || '#4f87e0',
        stroke: (el.get('stroke') as string) || '#2563eb',
        strokeWidth: (el.get('strokeWidth') as number) ?? 2,
      });
    } else if (type === 'table') {
      const rawTableData = el.get('tableData');
      const tableData: TableData = parseTableData(rawTableData) || { rows: 3, cols: 3, cells: [['', '', ''], ['', '', ''], ['', '', '']] };
      result.push({ ...base, tableData });
    } else {
      result.push(base);
    }
  }
  return result;
}
