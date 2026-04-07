/** Contract: contracts/app/rules.md */
import { EMOJIS_PART_1 } from './emoji-list-1.ts';
import { EMOJIS_PART_2 } from './emoji-list-2.ts';

export interface EmojiEntry {
  emoji: string;
  name: string;
  category: EmojiCategory;
  keywords: string[];
}

export type EmojiCategory =
  | 'smileys'
  | 'people'
  | 'animals'
  | 'food'
  | 'activities'
  | 'travel'
  | 'objects'
  | 'symbols';

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  'smileys', 'people', 'animals', 'food',
  'activities', 'travel', 'objects', 'symbols',
];

export const CATEGORY_ICONS: Record<EmojiCategory, string> = {
  smileys: '\u{1F600}',
  people: '\u{1F464}',
  animals: '\u{1F43E}',
  food: '\u{1F354}',
  activities: '\u{26BD}',
  travel: '\u{2708}\uFE0F',
  objects: '\u{1F4A1}',
  symbols: '\u{2764}\uFE0F',
};

/** Complete emoji list, combined from split data files. */
export const EMOJIS: EmojiEntry[] = [...EMOJIS_PART_1, ...EMOJIS_PART_2];

/** Look up an emoji by its colon-code name. */
export function findEmojiByName(name: string): EmojiEntry | undefined {
  return EMOJIS.find((e) => e.name === name);
}

/** Search emojis by partial name or keyword match. */
export function searchEmojis(query: string): EmojiEntry[] {
  const q = query.toLowerCase();
  return EMOJIS.filter(
    (e) =>
      e.name.includes(q) ||
      e.keywords.some((kw) => kw.includes(q)),
  );
}

/** Get emojis for a specific category. */
export function getEmojisByCategory(category: EmojiCategory): EmojiEntry[] {
  return EMOJIS.filter((e) => e.category === category);
}
