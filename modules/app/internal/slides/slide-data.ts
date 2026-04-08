/** Contract: contracts/app/rules.md */

/**
 * Yjs slide data extraction and application helpers.
 * Used by import/export to serialize/deserialize slides.
 */

import * as Y from 'yjs';

export type SlideData = {
  layout: string;
  elements: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    content: string;
    attrs?: Record<string, unknown>;
  }>;
};

/** Extract slides data from Yjs for export */
export function extractSlidesData(yslides: Y.Array<Y.Map<unknown>>): SlideData[] {
  const slides: SlideData[] = [];
  for (let i = 0; i < yslides.length; i++) {
    const slide = yslides.get(i);
    const layout = (slide.get('layout') as string) || 'blank';
    const yElements = slide.get('elements') as Y.Array<Y.Map<unknown>> | undefined;
    const elements: SlideData['elements'] = [];
    if (yElements) {
      for (let j = 0; j < yElements.length; j++) {
        const el = yElements.get(j);
        elements.push({
          id: (el.get('id') as string) || '',
          type: (el.get('type') as string) || 'text',
          x: (el.get('x') as number) || 0,
          y: (el.get('y') as number) || 0,
          width: (el.get('width') as number) || 50,
          height: (el.get('height') as number) || 20,
          content: (el.get('content') as string) || '',
        });
      }
    }
    slides.push({ layout, elements });
  }
  return slides;
}

/** Apply imported slides to the Yjs document */
export function applyImportedSlides(
  ydoc: Y.Doc,
  yslides: Y.Array<Y.Map<unknown>>,
  slides: SlideData[],
): void {
  ydoc.transact(() => {
    while (yslides.length > 0) {
      yslides.delete(0);
    }
    for (const slideData of slides) {
      const slide = new Y.Map<unknown>();
      slide.set('layout', slideData.layout);
      const elements = new Y.Array<Y.Map<unknown>>();
      for (const el of slideData.elements) {
        const yel = new Y.Map<unknown>();
        yel.set('id', el.id);
        yel.set('type', el.type);
        yel.set('x', el.x);
        yel.set('y', el.y);
        yel.set('width', el.width);
        yel.set('height', el.height);
        yel.set('content', el.content);
        if (el.attrs) yel.set('attrs', el.attrs);
        elements.push([yel]);
      }
      slide.set('elements', elements);
      yslides.push([slide]);
    }
  });
}
