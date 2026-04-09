/** Contract: contracts/app/rules.md */
import type { TranslationKeys } from './types.ts';
import { coreTranslations } from './fr-core.ts';
import { featureTranslations } from './fr-features.ts';
import { a11yTranslations } from './fr-a11y.ts';

export const fr: TranslationKeys = {
  ...coreTranslations,
  ...featureTranslations,
  ...a11yTranslations,
} as TranslationKeys;
