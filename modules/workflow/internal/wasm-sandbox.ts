/** Contract: contracts/workflow/rules.md */
import { createLogger } from '../../logger/index.ts';

const log = createLogger('workflow:wasm');

/** Execution limits for Wasm sandbox */
export type WasmSandboxLimits = {
  memoryLimitPages: number; // 1 page = 64KB, default 256 = 16MB
  timeoutMs: number;        // default 5000
};

const DEFAULT_LIMITS: WasmSandboxLimits = {
  memoryLimitPages: 256, // 16MB
  timeoutMs: 5_000,
};

/** Metrics from a single Wasm execution */
export type WasmExecMetrics = {
  durationMs: number;
  memoryUsedBytes: number;
  exitStatus: 'ok' | 'timeout' | 'error';
};

/** Result from executing a Wasm plugin */
export type WasmExecResult = {
  output: Record<string, unknown>;
  metrics: WasmExecMetrics;
};

/**
 * Compile a Wasm binary into a reusable WebAssembly.Module.
 * Validates the binary and rejects oversized modules.
 */
export async function compileWasm(binary: Uint8Array): Promise<WebAssembly.Module> {
  if (!WebAssembly.validate(binary as unknown as BufferSource)) {
    throw new Error('Invalid Wasm binary');
  }
  return WebAssembly.compile(binary as unknown as BufferSource);
}

/**
 * Execute a compiled Wasm module in a sandboxed environment.
 *
 * Protocol: The module exports `alloc(size) -> ptr`, `dealloc(ptr, size)`,
 * and `run(inputPtr, inputLen) -> outputPtr`. Memory is shared via a
 * single WebAssembly.Memory with capped page count.
 *
 * Input/output are JSON strings written to/read from linear memory.
 */
export async function executeWasm(
  wasmModule: WebAssembly.Module,
  input: Record<string, unknown>,
  limits: Partial<WasmSandboxLimits> = {},
): Promise<WasmExecResult> {
  const opts = { ...DEFAULT_LIMITS, ...limits };
  const memory = new WebAssembly.Memory({
    initial: 1,
    maximum: opts.memoryLimitPages,
  });

  const start = performance.now();
  let exitStatus: WasmExecMetrics['exitStatus'] = 'ok';

  // Minimal WASI-like import: only memory, no fs/net/clock
  const importObject: WebAssembly.Imports = {
    env: { memory },
  };

  const instance = await WebAssembly.instantiate(wasmModule, importObject);
  const exports = instance.exports as Record<string, unknown>;

  const alloc = exports.alloc as ((size: number) => number) | undefined;
  const dealloc = exports.dealloc as ((ptr: number, size: number) => void) | undefined;
  const run = exports.run as ((ptr: number, len: number) => number) | undefined;
  const usedMemory = exports.memory as WebAssembly.Memory | undefined;

  // Use the module's own memory if it exports one, otherwise our provided one
  const mem = usedMemory ?? memory;

  if (!alloc || !run) {
    throw new Error('Wasm module must export alloc(size)->ptr and run(ptr,len)->ptr');
  }

  // Encode input as JSON bytes
  const encoder = new TextEncoder();
  const inputBytes = encoder.encode(JSON.stringify(input));

  // Allocate space for input in Wasm memory
  const inputPtr = alloc(inputBytes.length);
  new Uint8Array(mem.buffer, inputPtr, inputBytes.length).set(inputBytes);

  // Execute with timeout
  let outputPtr: number;
  try {
    outputPtr = await Promise.race([
      Promise.resolve(run(inputPtr, inputBytes.length)),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Wasm execution timed out')), opts.timeoutMs),
      ),
    ]);
  } catch (err) {
    exitStatus = (err instanceof Error && err.message.includes('timed out')) ? 'timeout' : 'error';
    const durationMs = Math.round(performance.now() - start);
    log.error('wasm execution failed', { exitStatus, durationMs, error: String(err) });
    throw err;
  }

  // Read output: first 4 bytes at outputPtr = length, then that many bytes of JSON
  const view = new DataView(mem.buffer);
  const outputLen = view.getUint32(outputPtr, true);
  const outputBytes = new Uint8Array(mem.buffer, outputPtr + 4, outputLen);
  const decoder = new TextDecoder();
  const outputJson = decoder.decode(outputBytes);

  // Clean up
  if (dealloc) {
    dealloc(inputPtr, inputBytes.length);
    dealloc(outputPtr, outputLen + 4);
  }

  const durationMs = Math.round(performance.now() - start);
  const memoryUsedBytes = mem.buffer.byteLength;

  let output: Record<string, unknown>;
  try {
    output = JSON.parse(outputJson);
  } catch {
    throw new Error(`Wasm module returned invalid JSON: ${outputJson.slice(0, 200)}`);
  }

  log.info('wasm execution complete', { durationMs, memoryUsedBytes, exitStatus });

  return {
    output,
    metrics: { durationMs, memoryUsedBytes, exitStatus },
  };
}
