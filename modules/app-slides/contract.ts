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

// --- Table Bounds ---

export const MAX_TABLE_ROWS = 50;
export const MAX_TABLE_COLS = 20;
const MAX_CELL_BYTES = 8192;

// --- Table Data ---

export const TableDataSchema = z.object({
  rows: z.number().int().positive().max(MAX_TABLE_ROWS),
  cols: z.number().int().positive().max(MAX_TABLE_COLS),
  cells: z.array(z.array(z.string().max(MAX_CELL_BYTES))),
});

export type TableData = z.infer<typeof TableDataSchema>;

// --- Animation ---

export const AnimationEffectSchema = z.enum([
  // Entrance
  'fade-in', 'fly-in-left', 'fly-in-right', 'fly-in-top', 'fly-in-bottom',
  'zoom-in', 'wipe-right',
  // Exit
  'fade-out', 'fly-out-left', 'fly-out-right', 'zoom-out',
  // Emphasis
  'pulse', 'spin',
]);

export type AnimationEffect = z.infer<typeof AnimationEffectSchema>;

export const AnimationTriggerSchema = z.enum(['on-click', 'with-previous', 'after-previous']);

export type AnimationTrigger = z.infer<typeof AnimationTriggerSchema>;

export const ElementAnimationSchema = z.object({
  id: z.string().min(1),
  elementId: z.string().min(1),
  effect: AnimationEffectSchema,
  trigger: AnimationTriggerSchema,
  durationMs: z.number().int().positive(),
  delayMs: z.number().int().nonnegative(),
});

export type ElementAnimation = z.infer<typeof ElementAnimationSchema>;

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
  // Image elements — must be http(s) or a relative /uploads/ path (invariant 11)
  src: z.string().max(2048).refine(
    (u) => /^https?:\/\//.test(u) || u.startsWith('/uploads/'),
    { message: 'Image src must be http(s) or relative /uploads/ path' },
  ).optional(),
  // Shape elements
  shapeType: ShapeTypeSchema.optional(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  // Table elements
  tableData: TableDataSchema.optional(),
});

export type SlideElement = z.infer<typeof SlideElementSchema>;
