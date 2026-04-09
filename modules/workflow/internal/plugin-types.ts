/** Contract: contracts/workflow/rules.md */
import { z } from 'zod';

/** Wasm plugin metadata (binary excluded from API responses) */
export type WasmPlugin = {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  version: string;
  builtIn: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateWasmPlugin = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  version?: string;
  builtIn?: boolean;
};

/** Zod schema for wasm_plugin action config */
export const WasmPluginConfigSchema = z.object({
  wasmModuleId: z.string().min(1),
  inputMapping: z.record(z.string()).default({}),
  timeout: z.number().int().min(100).max(30_000).default(5_000),
});

export type WasmPluginConfig = z.infer<typeof WasmPluginConfigSchema>;

/** Schema for creating a plugin via API */
export const CreateWasmPluginSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
  inputSchema: z.record(z.unknown()).default({}),
  outputSchema: z.record(z.unknown()).default({}),
  version: z.string().max(20).default('1.0.0'),
});
