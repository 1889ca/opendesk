/** Contract: contracts/app-slides/rules.md */
import { z } from 'zod';

// --- Shape Type ---

export const ShapeTypeSchema = z.enum([
  'rectangle', 'rounded-rect', 'ellipse', 'triangle', 'arrow', 'line',
]);

export type ShapeType = z.infer<typeof ShapeTypeSchema>;

// --- Text Align ---

export const TextAlignSchema = z.enum(['left', 'center', 'right']);

export type TextAlign = z.infer<typeof TextAlignSchema>;

// --- Table Data ---

export const TableDataSchema = z.object({
  rows: z.number().int().positive(),
  cols: z.number().int().positive(),
  cells: z.array(z.array(z.string())),
});

export type TableData = z.infer<typeof TableDataSchema>;

// --- Slide Element ---

export const SlideElementSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['text', 'shape', 'image', 'table']),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number(),
  content: z.string(),
  // Text formatting
  fontSize: z.number().optional(),
  fontColor: z.string().optional(),
  textAlign: TextAlignSchema.optional(),
  // Image elements
  src: z.string().optional(),
  // Shape elements
  shapeType: ShapeTypeSchema.optional(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  // Table elements
  tableData: TableDataSchema.optional(),
});

export type SlideElement = z.infer<typeof SlideElementSchema>;
