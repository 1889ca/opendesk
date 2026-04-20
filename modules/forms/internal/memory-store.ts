/** Contract: contracts/forms/rules.md */

/**
 * In-memory FormStore used for early wiring and tests.
 * A Postgres-backed implementation will replace this; the public
 * interface (FormStore) is stable.
 *
 * Skeleton only — does not enforce every invariant in the contract.
 * Production invariants (idempotent single_response, file-size caps,
 * erasure cascade, audit emission) are implemented against the
 * eventual pg-store.
 */

import { randomUUID } from 'node:crypto';
import {
  FormDefinitionSchema,
  FormResponseSchema,
  type FormDefinition,
  type FormResponse,
  type FormStore,
} from '../contract.ts';

export function createMemoryFormStore(): FormStore {
  const definitions = new Map<string, FormDefinition>();
  const responses = new Map<string, FormResponse[]>();
  const closed = new Set<string>();

  return {
    async createDefinition(input) {
      const def: FormDefinition = FormDefinitionSchema.parse({
        ...input,
        updated_at: new Date().toISOString(),
      });
      definitions.set(def.id, def);
      responses.set(def.id, []);
      return def;
    },

    async getDefinition(id) {
      return definitions.get(id) ?? null;
    },

    async updateDefinition(id, patch) {
      const prev = definitions.get(id);
      if (!prev) throw new Error(`form not found: ${id}`);
      const next: FormDefinition = FormDefinitionSchema.parse({
        ...prev,
        ...patch,
        version: prev.version + 1,
        updated_at: new Date().toISOString(),
      });
      definitions.set(id, next);
      return next;
    },

    async submitResponse(input) {
      if (closed.has(input.form_id)) {
        const err = new Error('form closed');
        (err as Error & { code?: string }).code = 'FORM_CLOSED';
        throw err;
      }
      const def = definitions.get(input.form_id);
      if (!def) throw new Error(`form not found: ${input.form_id}`);
      if (def.close_at && new Date(def.close_at).getTime() <= Date.now()) {
        closed.add(input.form_id);
        const err = new Error('form closed');
        (err as Error & { code?: string }).code = 'FORM_CLOSED';
        throw err;
      }
      const row: FormResponse = FormResponseSchema.parse({
        id: randomUUID(),
        submitted_at: new Date().toISOString(),
        ...input,
      });
      const bucket = responses.get(input.form_id) ?? [];
      bucket.push(row);
      responses.set(input.form_id, bucket);
      return row;
    },

    async listResponses(formId, limit = 100, offset = 0) {
      const bucket = responses.get(formId) ?? [];
      return bucket.slice(offset, offset + limit);
    },

    async closeForm(id) {
      closed.add(id);
    },
  };
}
