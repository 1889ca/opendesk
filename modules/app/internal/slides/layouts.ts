/** Contract: contracts/app/slides-interaction.md */

import type { NewElement } from './element-factory.ts';
import { TEXT_DEFAULTS, TITLE_DEFAULTS } from './tiptap-mini-editor.ts';

/** Supported slide layout types. */
export type LayoutType = 'blank' | 'title' | 'title-content' | 'two-column' | 'section-header' | 'title-only';

export const LAYOUT_TYPES: LayoutType[] = [
  'blank', 'title', 'title-content', 'two-column', 'section-header', 'title-only',
];

export const LAYOUT_LABELS: Record<LayoutType, string> = {
  'blank': 'Blank',
  'title': 'Title Slide',
  'title-content': 'Title + Content',
  'two-column': 'Two Columns',
  'section-header': 'Section Header',
  'title-only': 'Title Only',
};

/** A placeholder defines a named region with position and text defaults. */
interface Placeholder {
  role: 'title' | 'subtitle' | 'content' | 'content-left' | 'content-right';
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontColor: string;
  textAlign: 'left' | 'center' | 'right';
  defaultText: string;
}

/** Layout definitions: each layout is an array of placeholder regions. */
const LAYOUTS: Record<LayoutType, Placeholder[]> = {
  blank: [],

  title: [
    { role: 'title', x: 10, y: 25, width: 80, height: 20, ...TITLE_DEFAULTS, defaultText: '<p>Presentation Title</p>' },
    { role: 'subtitle', x: 15, y: 50, width: 70, height: 12, fontSize: 20, fontColor: '#6b7280', textAlign: 'center', defaultText: '<p>Subtitle or author name</p>' },
  ],

  'title-content': [
    { role: 'title', x: 5, y: 3, width: 90, height: 12, fontSize: 28, fontColor: '#000000', textAlign: 'left', defaultText: '<p>Slide Title</p>' },
    { role: 'content', x: 5, y: 18, width: 90, height: 75, ...TEXT_DEFAULTS, defaultText: '<p>Click to add content</p>' },
  ],

  'two-column': [
    { role: 'title', x: 5, y: 3, width: 90, height: 12, fontSize: 28, fontColor: '#000000', textAlign: 'left', defaultText: '<p>Slide Title</p>' },
    { role: 'content-left', x: 5, y: 18, width: 43, height: 75, ...TEXT_DEFAULTS, defaultText: '<p>Left column</p>' },
    { role: 'content-right', x: 52, y: 18, width: 43, height: 75, ...TEXT_DEFAULTS, defaultText: '<p>Right column</p>' },
  ],

  'section-header': [
    { role: 'title', x: 10, y: 30, width: 80, height: 20, fontSize: 40, fontColor: '#000000', textAlign: 'center', defaultText: '<p>Section Title</p>' },
    { role: 'subtitle', x: 20, y: 55, width: 60, height: 10, fontSize: 18, fontColor: '#6b7280', textAlign: 'center', defaultText: '<p>Section description</p>' },
  ],

  'title-only': [
    { role: 'title', x: 5, y: 3, width: 90, height: 12, fontSize: 28, fontColor: '#000000', textAlign: 'left', defaultText: '<p>Slide Title</p>' },
  ],
};

/** Generate elements for a given layout type. Returns NewElement[] to insert into Yjs. */
export function createLayoutElements(layout: LayoutType): Omit<NewElement, 'id'>[] {
  const placeholders = LAYOUTS[layout];
  return placeholders.map((p) => ({
    type: 'text' as const,
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
    rotation: 0,
    content: p.defaultText,
    fontSize: p.fontSize,
    fontColor: p.fontColor,
    textAlign: p.textAlign,
  }));
}

/** Get the placeholder definitions for a layout (for thumbnail previews). */
export function getLayoutPlaceholders(layout: LayoutType): Placeholder[] {
  return LAYOUTS[layout] ?? [];
}
