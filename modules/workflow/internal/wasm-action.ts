/** Contract: contracts/workflow/rules.md */
import type { Pool } from 'pg';
import type { DomainEvent } from '../../events/contract.ts';
import type { WasmPluginConfig } from './plugin-types.ts';
import { getPlugin, getPluginBinary } from './plugin-store.ts';
import { compileWasm, executeWasm } from './wasm-sandbox.ts';
import { executeBuiltin } from './wasm-builtins.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('workflow:wasm-action');

/** Cache compiled modules to avoid recompilation */
const moduleCache = new Map<string, WebAssembly.Module>();

function buildWasmInput(
  config: WasmPluginConfig,
  event: DomainEvent,
  eventContext: Record<string, unknown>,
): Record<string, unknown> {
  const input: Record<string, unknown> = {
    event: {
      id: event.id,
      type: event.type,
      aggregateId: event.aggregateId,
      actorId: event.actorId,
      occurredAt: event.occurredAt,
    },
  };

  // Apply input mappings: map context fields into input
  for (const [targetKey, sourcePath] of Object.entries(config.inputMapping)) {
    const value = resolveContextPath(eventContext, sourcePath);
    if (value !== undefined) {
      input[targetKey] = value;
    }
  }

  return input;
}

function resolveContextPath(
  context: Record<string, unknown>,
  path: string,
): unknown {
  const parts = path.split('.');
  let current: unknown = context;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Execute a wasm_plugin action: load binary, compile, run in sandbox.
 * Returns the plugin output for use by downstream graph nodes.
 */
export async function runWasmPlugin(
  pool: Pool,
  config: WasmPluginConfig,
  event: DomainEvent,
  eventContext: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { wasmModuleId, timeout } = config;
  const input = buildWasmInput(config, event, eventContext);

  // Check if this is a built-in plugin (uses JS executor, not Wasm binary)
  const pluginMeta = await getPlugin(pool, wasmModuleId);
  if (!pluginMeta) {
    throw new Error(`Wasm plugin not found: ${wasmModuleId}`);
  }

  if (pluginMeta.builtIn) {
    const builtinResult = executeBuiltin(pluginMeta.name, input);
    if (builtinResult) {
      log.info('built-in plugin executed', { name: pluginMeta.name });
      return builtinResult;
    }
  }

  // Real Wasm execution: compile and cache
  let wasmModule = moduleCache.get(wasmModuleId);

  if (!wasmModule) {
    const binary = await getPluginBinary(pool, wasmModuleId);
    if (!binary) {
      throw new Error(`Wasm binary not found: ${wasmModuleId}`);
    }
    wasmModule = await compileWasm(new Uint8Array(binary));
    moduleCache.set(wasmModuleId, wasmModule);
    log.info('wasm module compiled and cached', { wasmModuleId });
  }

  const result = await executeWasm(wasmModule, input, { timeoutMs: timeout });

  log.info('wasm plugin executed', {
    wasmModuleId,
    durationMs: result.metrics.durationMs,
    memoryUsedBytes: result.metrics.memoryUsedBytes,
  });

  return result.output;
}

/** Clear the module cache (for testing or hot-reload) */
export function clearModuleCache(): void {
  moduleCache.clear();
}
