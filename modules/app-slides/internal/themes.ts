/** Contract: contracts/app-slides/rules.md */

/** A slide theme defines colors, fonts, and background applied to the entire presentation. */
export interface SlideTheme {
  id: string;
  name: string;
  background: string;
  textColor: string;
  headingColor: string;
  accentColor: string;
  fontFamily: string;
  headingFont: string;
}

/** Built-in theme presets. */
export const THEME_PRESETS: SlideTheme[] = [
  {
    id: 'default',
    name: 'Default',
    background: '#ffffff',
    textColor: '#1f2937',
    headingColor: '#111827',
    accentColor: '#2563eb',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    headingFont: 'system-ui, -apple-system, sans-serif',
  },
  {
    id: 'dark',
    name: 'Dark',
    background: '#1e1e2e',
    textColor: '#cdd6f4',
    headingColor: '#ffffff',
    accentColor: '#89b4fa',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    headingFont: 'system-ui, -apple-system, sans-serif',
  },
  {
    id: 'corporate',
    name: 'Corporate',
    background: '#f8fafc',
    textColor: '#334155',
    headingColor: '#0f172a',
    accentColor: '#0369a1',
    fontFamily: 'Georgia, serif',
    headingFont: 'system-ui, -apple-system, sans-serif',
  },
  {
    id: 'warm',
    name: 'Warm',
    background: '#fef7ee',
    textColor: '#44403c',
    headingColor: '#292524',
    accentColor: '#c2410c',
    fontFamily: 'Georgia, serif',
    headingFont: 'Georgia, serif',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    background: '#fafafa',
    textColor: '#525252',
    headingColor: '#171717',
    accentColor: '#171717',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    headingFont: 'system-ui, -apple-system, sans-serif',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    background: '#0c4a6e',
    textColor: '#e0f2fe',
    headingColor: '#ffffff',
    accentColor: '#38bdf8',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    headingFont: 'system-ui, -apple-system, sans-serif',
  },
];

/** Apply a theme to the slide viewport via CSS custom properties. */
export function applyTheme(viewport: HTMLElement, theme: SlideTheme): void {
  viewport.style.setProperty('--slide-bg', theme.background);
  viewport.style.setProperty('--slide-text', theme.textColor);
  viewport.style.setProperty('--slide-heading', theme.headingColor);
  viewport.style.setProperty('--slide-accent', theme.accentColor);
  viewport.style.setProperty('--slide-font', theme.fontFamily);
  viewport.style.setProperty('--slide-heading-font', theme.headingFont);
  viewport.style.backgroundColor = theme.background;
}

/** Find a theme preset by ID, falling back to default. */
export function getThemeById(id: string): SlideTheme {
  return THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0];
}

/** Serialize theme to Yjs-compatible record. */
export function themeToRecord(theme: SlideTheme): Record<string, string> {
  return {
    id: theme.id,
    name: theme.name,
    background: theme.background,
    textColor: theme.textColor,
    headingColor: theme.headingColor,
    accentColor: theme.accentColor,
    fontFamily: theme.fontFamily,
    headingFont: theme.headingFont,
  };
}

/** Deserialize a Yjs record to a SlideTheme. */
export function recordToTheme(rec: Record<string, unknown>): SlideTheme {
  const fallback = THEME_PRESETS[0];
  return {
    id: String(rec.id ?? fallback.id),
    name: String(rec.name ?? fallback.name),
    background: String(rec.background ?? fallback.background),
    textColor: String(rec.textColor ?? fallback.textColor),
    headingColor: String(rec.headingColor ?? fallback.headingColor),
    accentColor: String(rec.accentColor ?? fallback.accentColor),
    fontFamily: String(rec.fontFamily ?? fallback.fontFamily),
    headingFont: String(rec.headingFont ?? fallback.headingFont),
  };
}
