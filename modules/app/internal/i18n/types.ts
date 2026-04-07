/** Contract: contracts/app/rules.md */
/**
 * All translation keys used in the app.
 * Both en.ts and fr.ts must implement this type fully.
 *
 * Split into domain-specific sub-interfaces to stay under 200 lines:
 * - types-core.ts: toolbar, status, editor, export, doc list, time
 * - types-features.ts: table, image, search, comments, suggestions, etc.
 * - types-a11y.ts: accessibility labels + keyboard shortcuts
 */
export type { CoreTranslationKeys } from './types-core.ts';
export type { FeatureTranslationKeys } from './types-features.ts';
export type { A11yTranslationKeys } from './types-a11y.ts';

import type { CoreTranslationKeys } from './types-core.ts';
import type { FeatureTranslationKeys } from './types-features.ts';
import type { A11yTranslationKeys } from './types-a11y.ts';

export interface TranslationKeys
  extends CoreTranslationKeys, FeatureTranslationKeys, A11yTranslationKeys {}

export type TranslationKey = keyof TranslationKeys;
export type Locale = 'en' | 'fr';
