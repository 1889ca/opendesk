/** Contract: contracts/ai/rules.md */

// Schemas (Zod)
export {
  ModelCapabilitySchema,
  QualityTierSchema,
  UseCaseTagSchema,
  HardwareReqsSchema,
  ModelZooEntrySchema,
  CustomModelSchema,
  ModelConfigSchema,
  OllamaModelInfoSchema,
  PullProgressSchema,
  AiConfigSchema,
} from './contract.ts';

// Types
export type {
  ModelCapability,
  QualityTier,
  UseCaseTag,
  HardwareReqs,
  ModelZooEntry,
  CustomModel,
  ModelConfig,
  OllamaModelInfo,
  PullProgress,
  AiConfig,
} from './contract.ts';

// Zoo
export { loadZoo, findZooEntry } from './internal/zoo-loader.ts';

// Ollama client
export { createOllamaClient } from './internal/ollama-client.ts';
export type { OllamaClient } from './internal/ollama-client.ts';

// Config store
export { ensureAiSchema, getModelConfig, setActiveModel } from './internal/config-store.ts';

// Model service
export { createModelService } from './internal/model-service.ts';
export type { ModelService, ModelListItem } from './internal/model-service.ts';

// Routes
export { createAiRoutes } from './internal/ai-routes.ts';
