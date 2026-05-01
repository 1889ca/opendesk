/** Contract: contracts/diagrams/rules.md */

/**
 * Skeleton in-memory DiagramStore.
 * Real impl will:
 *   - Persist `DiagramDefinition` as a Yjs doc via `collab`
 *   - Register a KB entry of type `diagram` on save
 *   - Render SVG via a shared client/server renderer that emits
 *     byte-identical output for the same definition + shape library
 *     version
 *   - Enforce MAX_SHAPES_PER_PAGE
 */

import {
  DiagramDefinitionSchema,
  MAX_SHAPES_PER_PAGE,
  type DiagramDefinition,
  type DiagramStore,
} from '../contract.ts';

function enforceShapeCap(def: DiagramDefinition): void {
  const perPage = new Map<number, number>();
  for (const shape of def.shapes) {
    perPage.set(shape.page, (perPage.get(shape.page) ?? 0) + 1);
  }
  for (const [page, count] of perPage) {
    if (count > MAX_SHAPES_PER_PAGE) {
      const err = new Error(`page ${page} exceeds shape cap (${count} > ${MAX_SHAPES_PER_PAGE})`);
      (err as Error & { code?: string }).code = 'CAPACITY';
      throw err;
    }
  }
}

export function createMemoryDiagramStore(): DiagramStore {
  const defs = new Map<string, DiagramDefinition>();

  return {
    async create(input) {
      const def: DiagramDefinition = DiagramDefinitionSchema.parse({
        ...input,
        updated_at: new Date().toISOString(),
      });
      enforceShapeCap(def);
      defs.set(def.id, def);
      return def;
    },

    async get(id) {
      return defs.get(id) ?? null;
    },

    async update(id, patch) {
      const prev = defs.get(id);
      if (!prev) throw new Error(`diagram not found: ${id}`);
      const next: DiagramDefinition = DiagramDefinitionSchema.parse({
        ...prev,
        ...patch,
        updated_at: new Date().toISOString(),
      });
      enforceShapeCap(next);
      defs.set(id, next);
      return next;
    },

    async renderSvg(_id) {
      throw new Error('diagrams: SVG renderer not implemented (skeleton)');
    },
  };
}
