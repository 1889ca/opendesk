/** Contract: contracts/app/rules.md */

const STORAGE_KEY = 'opendesk:recentEmojis';
const MAX_RECENT = 16;

/** Get recently used emojis from localStorage. */
export function getRecentEmojis(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/** Add an emoji to the recently used list. */
export function addRecentEmoji(emoji: string): void {
  const recent = getRecentEmojis().filter((e) => e !== emoji);
  recent.unshift(emoji);
  if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
  } catch {
    // localStorage may be unavailable
  }
}
