/** Contract: contracts/workflow/rules.md */

/**
 * Built-in plugin executors that run as native JS instead of Wasm.
 * These are used for the default plugins shipped with OpenDesk.
 * They follow the same JSON-in/JSON-out protocol as Wasm plugins.
 */

type BuiltinExecutor = (input: Record<string, unknown>) => Record<string, unknown>;

function textTransformer(input: Record<string, unknown>): Record<string, unknown> {
  const text = String(input.text ?? '');
  const transform = String(input.transform ?? 'lowercase');

  let result: string;
  switch (transform) {
    case 'uppercase':
      result = text.toUpperCase();
      break;
    case 'lowercase':
      result = text.toLowerCase();
      break;
    case 'titlecase':
      result = text.replace(
        /\b\w/g,
        (ch) => ch.toUpperCase(),
      );
      break;
    default:
      result = text;
  }

  return { result, originalLength: text.length };
}

function jsonValidator(input: Record<string, unknown>): Record<string, unknown> {
  const data = input.data as Record<string, unknown> | undefined;
  const schema = input.schema as Record<string, unknown> | undefined;

  if (!data || !schema) {
    return { valid: false, errors: ['Missing data or schema'] };
  }

  const errors: string[] = [];
  const required = (schema.required as string[]) ?? [];
  const properties = (schema.properties as Record<string, Record<string, unknown>>) ?? {};

  // Check required fields
  for (const field of required) {
    if (!(field in data)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check property types
  for (const [key, propSchema] of Object.entries(properties)) {
    if (key in data && propSchema.type) {
      const actual = typeof data[key];
      const expected = String(propSchema.type);
      if (expected === 'array' && !Array.isArray(data[key])) {
        errors.push(`Field "${key}": expected array, got ${actual}`);
      } else if (expected !== 'array' && actual !== expected) {
        errors.push(`Field "${key}": expected ${expected}, got ${actual}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function wordCounter(input: Record<string, unknown>): Record<string, unknown> {
  const text = String(input.text ?? '');

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const characters = text.length;
  const sentences = text.trim() ? text.split(/[.!?]+/).filter(Boolean).length : 0;
  const paragraphs = text.trim() ? text.split(/\n\s*\n/).filter(Boolean).length : 0;

  return { words, characters, sentences, paragraphs };
}

const EXECUTORS: Record<string, BuiltinExecutor> = {
  'text-transformer': textTransformer,
  'json-validator': jsonValidator,
  'word-counter': wordCounter,
};

/**
 * Check if a plugin name corresponds to a built-in plugin.
 */
export function isBuiltinPlugin(name: string): boolean {
  return name in EXECUTORS;
}

/**
 * Execute a built-in plugin by name. Returns null if not a built-in.
 */
export function executeBuiltin(
  name: string,
  input: Record<string, unknown>,
): Record<string, unknown> | null {
  const executor = EXECUTORS[name];
  if (!executor) return null;
  return executor(input);
}
