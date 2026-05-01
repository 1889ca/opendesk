/** Contract: contracts/workflow/rules.md */
import { z } from 'zod';

// --- Action Config Schemas ---

export const WebhookConfigSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
});

export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

export const ExportConfigSchema = z.object({
  format: z.enum(['docx', 'odt', 'pdf']),
});

export type ExportConfig = z.infer<typeof ExportConfigSchema>;

export const NotifyConfigSchema = z.object({
  message: z.string().min(1),
});

export type NotifyConfig = z.infer<typeof NotifyConfigSchema>;

export const SetMetadataConfigSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export type SetMetadataConfig = z.infer<typeof SetMetadataConfigSchema>;

export const MoveToFolderConfigSchema = z.object({
  folderId: z.string().min(1),
});

export type MoveToFolderConfig = z.infer<typeof MoveToFolderConfigSchema>;

export const ChangeStatusConfigSchema = z.object({
  status: z.string().min(1),
});

export type ChangeStatusConfig = z.infer<typeof ChangeStatusConfigSchema>;

export const SendEmailConfigSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export type SendEmailConfig = z.infer<typeof SendEmailConfigSchema>;

export { WasmPluginConfigSchema, type WasmPluginConfig } from './plugin-types.ts';

// --- Condition Config (graph node conditions) ---

export const ConditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'greater_than',
  'less_than',
  'includes',
  'not_includes',
]);

export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

export const ConditionConfigSchema = z.object({
  field: z.string().min(1),
  operator: ConditionOperatorSchema,
  value: z.string(),
});

export type ConditionConfig = z.infer<typeof ConditionConfigSchema>;

// --- Trigger Conditions (pre-trigger filter evaluated before workflow fires) ---

/**
 * A leaf trigger condition tied to a specific trigger type.
 * `filter` keys are domain-specific and validated at evaluation time.
 *
 * document_version: filter fields — { versionNumber?: number, versionName?: string }
 * kb_entity_change:  filter fields — { field: string, operator: ConditionOperator, value: string }
 * form_submission:   filter fields — { field: string, operator: ConditionOperator, value: string }
 */
export const LeafTriggerConditionSchema = z.object({
  type: z.enum(['document_version', 'kb_entity_change', 'form_submission']),
  filter: z.record(z.unknown()),
});

export type LeafTriggerCondition = z.infer<typeof LeafTriggerConditionSchema>;

/**
 * A compound trigger condition combining multiple conditions with AND or OR.
 * Recursive type — Zod lazy() required.
 */
export type CompoundTriggerCondition = {
  operator: 'AND' | 'OR';
  conditions: TriggerCondition[];
};

export type TriggerCondition = LeafTriggerCondition | CompoundTriggerCondition;

const CompoundTriggerConditionSchema: z.ZodType<CompoundTriggerCondition> = z.lazy(() =>
  z.object({
    operator: z.enum(['AND', 'OR']),
    conditions: z.array(TriggerConditionSchema).min(1),
  }),
);

export const TriggerConditionSchema: z.ZodType<TriggerCondition> = z.lazy(() =>
  z.union([LeafTriggerConditionSchema, CompoundTriggerConditionSchema]),
);

// Filter schemas for each leaf condition type

export const DocumentVersionFilterSchema = z.object({
  versionNumber: z.number().int().positive().optional(),
  versionName: z.string().min(1).optional(),
}).refine(
  (f) => f.versionNumber !== undefined || f.versionName !== undefined,
  { message: 'At least one of versionNumber or versionName must be specified' },
);

export type DocumentVersionFilter = z.infer<typeof DocumentVersionFilterSchema>;

export const KBEntityChangeFilterSchema = z.object({
  field: z.string().min(1),
  operator: ConditionOperatorSchema,
  value: z.string(),
});

export type KBEntityChangeFilter = z.infer<typeof KBEntityChangeFilterSchema>;

export const FormSubmissionFilterSchema = z.object({
  field: z.string().min(1),
  operator: ConditionOperatorSchema,
  value: z.string(),
});

export type FormSubmissionFilter = z.infer<typeof FormSubmissionFilterSchema>;
