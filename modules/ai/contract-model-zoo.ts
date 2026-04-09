/** Contract: contracts/ai/rules.md */
import { z } from 'zod';

// --- Model Zoo: Capability ---

export const ModelCapabilitySchema = z.enum(['embed', 'generate', 'both']);
export type ModelCapability = z.infer<typeof ModelCapabilitySchema>;

// --- Model Zoo: Quality Tier ---

export const QualityTierSchema = z.enum(['recommended', 'lightweight', 'specialized']);
export type QualityTier = z.infer<typeof QualityTierSchema>;

// --- Model Zoo: Use Case Tag ---

export const UseCaseTagSchema = z.enum([
  'general', 'code', 'embedding', 'multilingual', 'legal', 'medical',
]);
export type UseCaseTag = z.infer<typeof UseCaseTagSchema>;

// --- Model Zoo: Hardware Requirements ---

export const HardwareReqsSchema = z.object({
  ramGb: z.number().positive(),
  vramGb: z.number().nonnegative(),
});
export type HardwareReqs = z.infer<typeof HardwareReqsSchema>;

// --- Model Zoo: Entry ---

export const ModelZooEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ollamaTag: z.string().min(1),
  sizeGb: z.number().positive(),
  capability: ModelCapabilitySchema,
  license: z.string().min(1),
  tier: QualityTierSchema,
  useCases: z.array(UseCaseTagSchema).min(1),
  hardware: HardwareReqsSchema,
  description: z.string().min(1),
});
export type ModelZooEntry = z.infer<typeof ModelZooEntrySchema>;

// --- Model Zoo: Custom Model ---

export const CustomModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ollamaTag: z.string().min(1),
  capability: ModelCapabilitySchema,
});
export type CustomModel = z.infer<typeof CustomModelSchema>;

// --- Model Zoo: Config (per-workspace) ---

export const ModelConfigSchema = z.object({
  workspaceId: z.string().min(1),
  embeddingModel: z.string().nullable(),
  generationModel: z.string().nullable(),
  updatedAt: z.coerce.date(),
});
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

// --- Model Zoo: Ollama Model Info ---

export const OllamaModelInfoSchema = z.object({
  name: z.string(),
  size: z.number(),
  digest: z.string(),
  modifiedAt: z.string(),
});
export type OllamaModelInfo = z.infer<typeof OllamaModelInfoSchema>;

// --- Model Zoo: Pull Progress ---

export const PullProgressSchema = z.object({
  status: z.string(),
  digest: z.string().optional(),
  total: z.number().optional(),
  completed: z.number().optional(),
});
export type PullProgress = z.infer<typeof PullProgressSchema>;
