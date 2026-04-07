/** Contract: contracts/app/rules.md */
import type { TranslationKeys } from './types.ts';
import { coreTranslations } from './fr-core.ts';
import { featureTranslations } from './fr-features.ts';

export const fr: TranslationKeys = {
  ...coreTranslations,
  ...featureTranslations,
} as TranslationKeys;
