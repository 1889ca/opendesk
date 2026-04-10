/** Contract: contracts/app/rules.md */
import type { TranslationKeys } from './types.ts';
import { coreTranslations } from './en-core.ts';
import { featureTranslations } from './en-features.ts';
import { a11yTranslations } from './en-a11y.ts';

export const en: TranslationKeys = {
  ...coreTranslations,
  ...featureTranslations,
  ...a11yTranslations,
} as TranslationKeys;
