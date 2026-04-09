/** Contract: contracts/ai/rules.md */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ModelZooEntrySchema, type ModelZooEntry } from '../contract.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ZOO_PATH = resolve(__dirname, 'model-zoo.json');

const ZooSchema = z.array(ModelZooEntrySchema);

let cached: ModelZooEntry[] | null = null;

/** Load and validate the curated model zoo from disk. Cached after first call. */
export function loadZoo(): ModelZooEntry[] {
  if (cached) return cached;
  const raw = JSON.parse(readFileSync(ZOO_PATH, 'utf-8'));
  cached = ZooSchema.parse(raw);
  return cached;
}

/** Find a zoo entry by ID. Returns undefined if not in the curated list. */
export function findZooEntry(id: string): ModelZooEntry | undefined {
  return loadZoo().find((e) => e.id === id);
}
