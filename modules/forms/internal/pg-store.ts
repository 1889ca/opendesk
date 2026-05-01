/** Contract: contracts/forms/rules.md */

import { randomUUID } from 'node:crypto';
import { pool } from '../../storage/internal/pool.ts';
import {
  FormDefinitionSchema,
  FormResponseSchema,
  type FormDefinition,
  type FormResponse,
  type FormStore,
} from '../contract.ts';

// ---------------------------------------------------------------------------
// Internal row types
// ---------------------------------------------------------------------------

interface FormRow {
  id: string;
  workspace_id: string;
  owner_id: string;
  title: string;
  schema: unknown;
  version: number;
  anonymous: boolean;
  single_response: boolean;
  close_at: Date | null;
  closed: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ResponseRow {
  id: string;
  form_id: string;
  definition_version: number;
  respondent_id: string | null;
  answers: unknown;
  tombstoned: boolean;
  ip_address: string | null;
  submitted_at: Date;
}

// ---------------------------------------------------------------------------
// Row → domain mappers
// ---------------------------------------------------------------------------

function rowToDef(row: FormRow): FormDefinition {
  const schema = row.schema as Record<string, unknown>;
  return FormDefinitionSchema.parse({
    id: row.id,
    workspace_id: row.workspace_id,
    version: row.version,
    title: row.title,
    description: schema.description,
    questions: schema.questions ?? [],
    anonymous: row.anonymous,
    single_response: row.single_response,
    close_at: row.close_at ? row.close_at.toISOString() : null,
    updated_at: row.updated_at.toISOString(),
  });
}

function rowToResponse(row: ResponseRow): FormResponse {
  return FormResponseSchema.parse({
    id: row.id,
    form_id: row.form_id,
    definition_version: row.definition_version,
    principal_id: row.respondent_id,
    answers: row.answers,
    submitted_at: row.submitted_at.toISOString(),
  });
}

// ---------------------------------------------------------------------------
// FormStore implementation
// ---------------------------------------------------------------------------

export function createPgFormStore(): FormStore {
  return {
    async createDefinition(input) {
      const id = input.id || `frm_${randomUUID()}`;
      const schema = { description: input.description, questions: input.questions };

      const result = await pool.query<FormRow>(
        `INSERT INTO forms
           (id, workspace_id, owner_id, title, schema, version, anonymous, single_response, close_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          id,
          input.workspace_id,
          (input as FormDefinition & { owner_id?: string }).owner_id ?? 'system',
          input.title,
          JSON.stringify(schema),
          input.version,
          input.anonymous,
          input.single_response,
          input.close_at ? new Date(input.close_at) : null,
        ],
      );
      return rowToDef(result.rows[0]);
    },

    async getDefinition(id) {
      const result = await pool.query<FormRow>(
        'SELECT * FROM forms WHERE id = $1',
        [id],
      );
      if (!result.rows[0]) return null;
      return rowToDef(result.rows[0]);
    },

    async updateDefinition(id, patch) {
      const current = await pool.query<FormRow>(
        'SELECT * FROM forms WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!current.rows[0]) throw new Error(`form not found: ${id}`);

      const prev = current.rows[0];
      const prevSchema = prev.schema as Record<string, unknown>;

      const newVersion = patch.version ?? prev.version + 1;
      const newTitle = patch.title ?? prev.title;
      const newAnonymous = patch.anonymous ?? prev.anonymous;
      const newSingleResponse = patch.single_response ?? prev.single_response;
      const newCloseAt = 'close_at' in patch
        ? (patch.close_at ? new Date(patch.close_at as string) : null)
        : prev.close_at;
      const newSchema = JSON.stringify({
        description: patch.description ?? prevSchema.description,
        questions: patch.questions ?? prevSchema.questions,
      });

      const result = await pool.query<FormRow>(
        `UPDATE forms
         SET title = $1, schema = $2, version = $3, anonymous = $4,
             single_response = $5, close_at = $6, updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [newTitle, newSchema, newVersion, newAnonymous, newSingleResponse, newCloseAt, id],
      );
      return rowToDef(result.rows[0]);
    },

    async submitResponse(input) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const formResult = await client.query<FormRow>(
          'SELECT * FROM forms WHERE id = $1',
          [input.form_id],
        );
        const form = formResult.rows[0];
        if (!form) throw Object.assign(new Error('form not found'), { code: 'FORM_NOT_FOUND' });

        // Check closed flag and close_at
        const isClosed = form.closed
          || (form.close_at !== null && new Date(form.close_at).getTime() <= Date.now());
        if (isClosed) {
          throw Object.assign(new Error('form closed'), { code: 'FORM_CLOSED' });
        }

        const responseId = `rsp_${randomUUID()}`;

        if (form.single_response && input.principal_id) {
          // Upsert: update existing row if one exists for this respondent
          const existing = await client.query<ResponseRow>(
            `SELECT id FROM form_responses
             WHERE form_id = $1 AND respondent_id = $2 AND tombstoned = FALSE`,
            [input.form_id, input.principal_id],
          );

          if (existing.rows[0]) {
            const result = await client.query<ResponseRow>(
              `UPDATE form_responses
               SET answers = $1, definition_version = $2, submitted_at = NOW()
               WHERE id = $3
               RETURNING *`,
              [JSON.stringify(input.answers), input.definition_version, existing.rows[0].id],
            );
            await client.query('COMMIT');
            return rowToResponse(result.rows[0]);
          }
        }

        const result = await client.query<ResponseRow>(
          `INSERT INTO form_responses
             (id, form_id, definition_version, respondent_id, answers)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            responseId,
            input.form_id,
            input.definition_version,
            input.principal_id ?? null,
            JSON.stringify(input.answers),
          ],
        );

        await client.query('COMMIT');
        return rowToResponse(result.rows[0]);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    async listResponses(formId, limit = 100, offset = 0) {
      const result = await pool.query<ResponseRow>(
        `SELECT * FROM form_responses
         WHERE form_id = $1 AND tombstoned = FALSE
         ORDER BY submitted_at ASC
         LIMIT $2 OFFSET $3`,
        [formId, limit, offset],
      );
      return result.rows.map(rowToResponse);
    },

    async closeForm(id) {
      await pool.query(
        'UPDATE forms SET closed = TRUE, updated_at = NOW() WHERE id = $1',
        [id],
      );
    },
  };
}
