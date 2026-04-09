/** Contract: contracts/workflow/rules.md */
import { describe, it, expect } from 'vitest';
import { compileWasm } from './wasm-sandbox.ts';

describe('wasm-sandbox', () => {
  describe('compileWasm', () => {
    it('rejects invalid binary', async () => {
      const invalid = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      await expect(compileWasm(invalid)).rejects.toThrow('Invalid Wasm binary');
    });

    it('compiles a minimal valid wasm module', async () => {
      // Minimal valid Wasm: magic number + version
      const minimal = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, // \0asm
        0x01, 0x00, 0x00, 0x00, // version 1
      ]);
      const mod = await compileWasm(minimal);
      expect(mod).toBeInstanceOf(WebAssembly.Module);
    });
  });
});
