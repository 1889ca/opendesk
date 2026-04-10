/** Contract: contracts/app/rules.md */

// Schemas (Zod)
export {
  LocaleSchema,
  TranslationKeySchema,
  EditorConfigSchema,
  LocaleResolutionSchema,
} from './contract.ts';

// Types
export type {
  Locale,
  TranslationKey,
  EditorConfig,
  LocaleResolution,
} from './contract.ts';

// Shared utilities — public API for extracted sub-modules (app-slides, app-sheets, etc.)
export { apiFetch } from './internal/shared/api-client.ts';
export { getUserIdentity, getDocumentId } from './internal/shared/identity.ts';
export { setupTitleSync } from './internal/shared/title-sync.ts';
export { uploadImage, validateImageFile, extractImageFiles } from './internal/editor/image-upload.ts';
export type { UploadResult } from './internal/editor/image-upload.ts';
export { initTheme } from './internal/shared/theme-toggle.ts';
export { mountAppToolbar } from './internal/shared/app-toolbar.ts';
export type { AppToolbarConfig, AppToolbarRefs } from './internal/shared/app-toolbar.ts';
