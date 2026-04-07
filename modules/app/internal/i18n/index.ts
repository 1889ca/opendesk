/** Contract: contracts/app/rules.md */
import type { TranslationKey, TranslationKeys, Locale } from './types.ts';
import { en } from './en.ts';
import { fr } from './fr.ts';

export type { TranslationKey, TranslationKeys, Locale };

const locales: Record<Locale, TranslationKeys> = { en, fr };

let currentLocale: Locale = 'en';

const listeners: Array<(locale: Locale) => void> = [];

/** Set the active locale. Notifies all subscribers. */
export function setLocale(locale: Locale): void {
  if (!locales[locale]) return;
  currentLocale = locale;
  for (const fn of listeners) fn(locale);
}

/** Get the current active locale. */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Translate a key, with optional interpolation.
 * Falls back to English if the key is missing in the current locale.
 * Falls back to the raw key if missing in both locales.
 *
 * Interpolation: t('key', { name: 'Alice' }) replaces {name} in the string.
 */
export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const table = locales[currentLocale];
  let value = table[key] ?? locales.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{${k}}`, String(v));
    }
  }
  return value;
}

/** Subscribe to locale changes. Returns an unsubscribe function. */
export function onLocaleChange(fn: (locale: Locale) => void): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

/** Resolve initial locale from localStorage or browser preference. */
export function resolveLocale(): Locale {
  const stored = globalThis.localStorage?.getItem('opendesk:locale');
  if (stored === 'fr' || stored === 'en') return stored;
  const browserLang = globalThis.navigator?.language ?? '';
  if (browserLang.startsWith('fr')) return 'fr';
  return 'en';
}

/** Persist locale choice to localStorage. */
export function persistLocale(locale: Locale): void {
  globalThis.localStorage?.setItem('opendesk:locale', locale);
}

/**
 * Validate that all keys in en exist in fr and vice versa.
 * Returns an array of missing key descriptions (empty = OK).
 */
export function validateCompleteness(): string[] {
  const errors: string[] = [];
  const enKeys = Object.keys(en) as TranslationKey[];
  const frKeys = Object.keys(fr) as TranslationKey[];
  for (const k of enKeys) {
    if (!(k in fr)) errors.push(`Missing in fr: ${k}`);
  }
  for (const k of frKeys) {
    if (!(k in en)) errors.push(`Missing in en: ${k}`);
  }
  return errors;
}
