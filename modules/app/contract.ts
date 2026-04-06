/** Contract: contracts/app/rules.md */
import { z } from 'zod';

// --- Locale ---

export const LocaleSchema = z.enum(['en', 'fr']);

export type Locale = z.infer<typeof LocaleSchema>;

// --- Translation Key ---

export const TranslationKeySchema = z.string().min(1).regex(
  /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/,
  'Translation keys use dot-separated camelCase segments'
);

export type TranslationKey = z.infer<typeof TranslationKeySchema>;

// --- Editor Config ---

export const EditorConfigSchema = z.object({
  websocketUrl: z.string().url(),
  documentId: z.string().min(1),
  locale: LocaleSchema,
  readOnly: z.boolean().default(false),
});

export type EditorConfig = z.infer<typeof EditorConfigSchema>;

// --- Locale Resolution ---

export const LocaleResolutionSchema = z.object({
  source: z.enum(['localStorage', 'browser', 'default']),
  resolved: LocaleSchema,
});

export type LocaleResolution = z.infer<typeof LocaleResolutionSchema>;
