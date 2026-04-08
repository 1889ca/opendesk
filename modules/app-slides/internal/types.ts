/** Contract: contracts/app-slides/rules.md */

export type ShapeType = 'rectangle' | 'rounded-rect' | 'ellipse' | 'triangle' | 'arrow' | 'line';

export type TableData = {
  rows: number;
  cols: number;
  cells: string[][];
};

export type TextAlign = 'left' | 'center' | 'right';

export type SlideElement = {
  id: string;
  type: 'text' | 'shape' | 'image' | 'table';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content: string;
  // Text formatting (text + shape elements)
  fontSize?: number;
  fontColor?: string;
  textAlign?: TextAlign;
  // Image elements
  src?: string;
  // Shape elements
  shapeType?: ShapeType;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  // Table elements
  tableData?: TableData;
};

export type Transform = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Point = {
  x: number;
  y: number;
};

export type HandlePosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top'
  | 'right'
  | 'bottom'
  | 'left';

export type SnapGuide = {
  axis: 'horizontal' | 'vertical';
  position: number; // percentage (0-100)
};

export type SnapResult = {
  snappedX: number;
  snappedY: number;
  guides: SnapGuide[];
};

export type InteractionMode = 'idle' | 'dragging' | 'resizing' | 'rotating' | 'marquee';

export type DragState = {
  elementIds: string[];
  startMousePercent: Point;
  startPositions: Map<string, Point>;
};

export type ResizeState = {
  elementId: string;
  handle: HandlePosition;
  startMousePercent: Point;
  startBounds: BoundingBox;
  aspectRatio: number;
  shiftHeld: boolean;
};

export type RotateState = {
  elementId: string;
  centerPercent: Point;
  startAngle: number;
  startRotation: number;
};

export type MarqueeState = {
  startPercent: Point;
  currentPercent: Point;
};

export const MIN_ELEMENT_WIDTH = 2;
export const MIN_ELEMENT_HEIGHT = 2;
export const GRID_SIZE = 5; // percentage units
export const SNAP_THRESHOLD = 1.5; // percentage units
export const NUDGE_SMALL = 1; // percentage
export const NUDGE_LARGE = 10; // percentage
