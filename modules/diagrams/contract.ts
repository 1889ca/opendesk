/** Contract: contracts/diagrams/rules.md */
import { z } from 'zod';

export const ShapeKindSchema = z.enum([
  'rect',
  'ellipse',
  'diamond',
  'triangle',
  'cylinder',
  'actor',
  'bpmn_task',
  'bpmn_gateway',
  'bpmn_event',
  'uml_class',
  'text',
]);

export type ShapeKind = z.infer<typeof ShapeKindSchema>;

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export type Point = z.infer<typeof PointSchema>;

export const ShapeSchema = z.object({
  id: z.string().min(1),
  kind: ShapeKindSchema,
  layer_id: z.string().min(1),
  page: z.number().int().min(0),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  rotation: z.number().default(0),
  text: z.string().default(''),
  alt_text: z.string().default(''),
  style_token: z.string().default('default'),
  z: z.number().int().default(0),
});

export type Shape = z.infer<typeof ShapeSchema>;

export const ConnectorRoutingSchema = z.enum(['orthogonal', 'straight', 'curved']);
export type ConnectorRouting = z.infer<typeof ConnectorRoutingSchema>;

export const ConnectorSchema = z.object({
  id: z.string().min(1),
  source_shape_id: z.string().min(1),
  target_shape_id: z.string().min(1),
  layer_id: z.string().min(1),
  page: z.number().int().min(0),
  routing: ConnectorRoutingSchema.default('orthogonal'),
  label: z.string().default(''),
  style_token: z.string().default('default'),
});

export type Connector = z.infer<typeof ConnectorSchema>;

export const LayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  order: z.number().int().default(0),
});

export type Layer = z.infer<typeof LayerSchema>;

export const MAX_SHAPES_PER_PAGE = 2000;

export const DiagramDefinitionSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  title: z.string().min(1),
  pages: z.number().int().min(1),
  layers: z.array(LayerSchema).min(1),
  shapes: z.array(ShapeSchema),
  connectors: z.array(ConnectorSchema),
  updated_at: z.string(),
});

export type DiagramDefinition = z.infer<typeof DiagramDefinitionSchema>;

export interface DiagramStore {
  create(input: Omit<DiagramDefinition, 'updated_at'>): Promise<DiagramDefinition>;
  get(id: string): Promise<DiagramDefinition | null>;
  update(id: string, patch: Partial<Omit<DiagramDefinition, 'id' | 'workspace_id'>>): Promise<DiagramDefinition>;
  renderSvg(id: string): Promise<string>;
}

export interface DiagramsModule {
  store: DiagramStore;
}
