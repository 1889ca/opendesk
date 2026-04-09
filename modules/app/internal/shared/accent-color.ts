/** Contract: contracts/app/rules.md */

const ACCENT_KEY = 'opendesk-accent';

export const ACCENT_PRESETS = [
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Green', value: '#059669' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Teal', value: '#0d9488' },
];

/** Darken a hex color by a percentage. */
function darken(hex: string, pct: number): string {
  const r = Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * (1 - pct / 100)));
  const g = Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * (1 - pct / 100)));
  const b = Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * (1 - pct / 100)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Apply accent color to CSS custom properties on :root. */
export function applyAccent(hex: string): void {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const style = document.documentElement.style;
  style.setProperty('--accent-color', hex);
  style.setProperty('--accent-hover', darken(hex, 15));
  style.setProperty('--accent-shadow', `rgba(${r}, ${g}, ${b}, 0.08)`);
  style.setProperty('--accent-shadow-strong', `rgba(${r}, ${g}, ${b}, 0.12)`);
  style.setProperty('--selection-bg', `rgba(${r}, ${g}, ${b}, 0.12)`);
}

/** Get stored accent color, defaulting to blue. */
export function getStoredAccent(): string {
  return globalThis.localStorage?.getItem(ACCENT_KEY) || ACCENT_PRESETS[0].value;
}

/** Persist an accent color to localStorage. */
export function saveAccent(hex: string): void {
  globalThis.localStorage?.setItem(ACCENT_KEY, hex);
}
