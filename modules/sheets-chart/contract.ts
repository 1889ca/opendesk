/** Contract: contracts/sheets-chart/rules.md */
import { z } from 'zod';

export const ChartTypeSchema = z.enum(['bar', 'line', 'pie', 'scatter']);
export type ChartType = z.infer<typeof ChartTypeSchema>;

export const PaletteNameSchema = z.enum(['default', 'vivid', 'muted']);

export const DataOrientationSchema = z.enum(['columns', 'rows']);

export const SeriesDefSchema = z.object({
  name: z.string().optional(),
  dataIndex: z.number().int().min(0),
});

export const ScatterSeriesDefSchema = z.object({
  name: z.string().optional(),
  xIndex: z.number().int().min(0),
  yIndex: z.number().int().min(0),
});

export const ChartConfigSchema = z.object({
  type: ChartTypeSchema,
  title: z.string().optional(),
  width: z.number().int().min(100).max(4000).default(600),
  height: z.number().int().min(100).max(4000).default(400),
  xLabel: z.string().optional(),
  yLabel: z.string().optional(),
  palette: PaletteNameSchema.default('default'),
  orientation: DataOrientationSchema.default('columns'),
  hasHeaders: z.boolean().default(true),
  categoryIndex: z.number().int().min(0).default(0),
  seriesIndices: z.array(z.number().int().min(0)).optional(),
  scatterSeries: z.array(ScatterSeriesDefSchema).optional(),
  stacked: z.boolean().default(false),
  showDots: z.boolean().default(true),
  showArea: z.boolean().default(false),
  showPercentages: z.boolean().default(true),
});

export type ChartConfig = z.infer<typeof ChartConfigSchema>;

export const ChartDataInputSchema = z.array(z.array(z.string()));
export type ChartDataInput = z.infer<typeof ChartDataInputSchema>;

export const ChartErrorSchema = z.object({
  type: z.literal('chart_error'),
  message: z.string(),
});

export const ChartOutputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('svg'), svg: z.string() }),
  ChartErrorSchema,
]);

export type ChartOutput = z.infer<typeof ChartOutputSchema>;
