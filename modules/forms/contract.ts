/** Contract: contracts/forms/rules.md */
import { z } from 'zod';

export const QuestionTypeSchema = z.enum([
  'short_text',
  'long_text',
  'single_choice',
  'multi_choice',
  'scale',
  'date',
  'file_upload',
  'email',
  'number',
]);

export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const QuestionSchema = z.object({
  id: z.string().min(1),
  type: QuestionTypeSchema,
  label: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().default(false),
  choices: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  regex: z.string().optional(),
});

export type Question = z.infer<typeof QuestionSchema>;

export const FormDefinitionSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  version: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  questions: z.array(QuestionSchema).max(250),
  anonymous: z.boolean().default(false),
  single_response: z.boolean().default(false),
  close_at: z.string().nullable(),
  updated_at: z.string(),
});

export type FormDefinition = z.infer<typeof FormDefinitionSchema>;

export const FormResponseSchema = z.object({
  id: z.string().min(1),
  form_id: z.string().min(1),
  definition_version: z.number().int().min(1),
  principal_id: z.string().nullable(),
  answers: z.record(z.unknown()),
  submitted_at: z.string(),
});

export type FormResponse = z.infer<typeof FormResponseSchema>;

export interface FormStore {
  createDefinition(input: Omit<FormDefinition, 'updated_at'>): Promise<FormDefinition>;
  getDefinition(id: string): Promise<FormDefinition | null>;
  updateDefinition(id: string, patch: Partial<Omit<FormDefinition, 'id' | 'workspace_id'>>): Promise<FormDefinition>;
  submitResponse(input: Omit<FormResponse, 'id' | 'submitted_at'>): Promise<FormResponse>;
  listResponses(formId: string, limit?: number, offset?: number): Promise<FormResponse[]>;
  closeForm(id: string): Promise<void>;
}

export interface FormsModule {
  store: FormStore;
}
