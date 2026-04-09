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

// --- Condition Config ---

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
