/** Contract: contracts/workflow/rules.md */
import type { Pool } from 'pg';
import { createLogger } from '../../logger/index.ts';
import { getPluginByName, createPlugin } from './plugin-store.ts';

const log = createLogger('workflow:builtin-plugins');

/**
 * Built-in plugin definitions. Each provides a minimal Wasm module
 * that processes JSON input and returns JSON output via linear memory.
 *
 * These are compiled from WAT at build time (see wat/ directory)
 * but for bootstrapping we use a JS-based fallback that registers
 * plugin metadata with placeholder binaries.
 *
 * The actual execution uses the JS sandbox fallback for built-in
 * plugins (see wasm-builtins.ts).
 */
const BUILTIN_PLUGINS = [
  {
    name: 'text-transformer',
    description: 'Transform text: uppercase, lowercase, or title-case document titles',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to transform' },
        transform: {
          type: 'string',
          enum: ['uppercase', 'lowercase', 'titlecase'],
          description: 'Transformation to apply',
        },
      },
      required: ['text', 'transform'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        result: { type: 'string', description: 'Transformed text' },
        originalLength: { type: 'number' },
      },
    },
  },
  {
    name: 'json-validator',
    description: 'Validate document metadata against a JSON schema',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'object', description: 'Data to validate' },
        schema: { type: 'object', description: 'JSON Schema to validate against' },
      },
      required: ['data', 'schema'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        errors: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'word-counter',
    description: 'Count words, characters, and sentences in text',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to analyze' },
      },
      required: ['text'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        words: { type: 'number' },
        characters: { type: 'number' },
        sentences: { type: 'number' },
        paragraphs: { type: 'number' },
      },
    },
  },
];

/**
 * Minimal valid Wasm module (empty but valid).
 * Built-in plugins use the JS fallback executor rather than raw Wasm.
 */
const MINIMAL_WASM = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, // magic: \0asm
  0x01, 0x00, 0x00, 0x00, // version: 1
]);

/**
 * Seed built-in plugins into the database if they don't exist.
 * Called during server startup.
 */
export async function seedBuiltinPlugins(pool: Pool): Promise<void> {
  for (const def of BUILTIN_PLUGINS) {
    const existing = await getPluginByName(pool, def.name);
    if (existing) continue;

    await createPlugin(pool, {
      name: def.name,
      description: def.description,
      inputSchema: def.inputSchema,
      outputSchema: def.outputSchema,
      version: '1.0.0',
      builtIn: true,
    }, Buffer.from(MINIMAL_WASM));

    log.info('seeded built-in plugin', { name: def.name });
  }
}
