/** Contract: contracts/app/rules.md */
import type { TranslationKeys } from './types.ts';
import { coreTranslations } from './en-core.ts';
import { featureTranslations } from './en-features.ts';

export const en: TranslationKeys = {
  ...coreTranslations,
  ...featureTranslations,
} as TranslationKeys;
