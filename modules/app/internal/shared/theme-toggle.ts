/** Contract: contracts/app/rules.md */
import { t, onLocaleChange } from '../i18n/index.ts';

type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'opendesk-theme';
const MODES: ThemeMode[] = ['light', 'dark', 'system'];

let currentMode: ThemeMode = 'system';
let mediaQuery: MediaQueryList | null = null;

/** Get the stored theme preference, defaulting to system. */
function getStoredMode(): ThemeMode {
  const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

/** Resolve the effective theme (light or dark) from the current mode. */
function resolveEffective(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode;
  return mediaQuery?.matches ? 'dark' : 'light';
}

/** Apply the theme to the document. */
function applyTheme(mode: ThemeMode): void {
  const effective = resolveEffective(mode);
  document.documentElement.setAttribute('data-theme', effective);
}

/** Get the display label for the current mode. */
function getLabel(mode: ThemeMode): string {
  const labelMap: Record<ThemeMode, string> = {
    light: t('theme.light'),
    dark: t('theme.dark'),
    system: t('theme.system'),
  };
  return labelMap[mode];
}

/** Get the icon for the current mode. */
function getIcon(mode: ThemeMode): string {
  const iconMap: Record<ThemeMode, string> = {
    light: '\u2600',
    dark: '\u263E',
    system: '\u25D0',
  };
  return iconMap[mode];
}

/** Cycle to the next mode: light -> dark -> system -> light. */
function nextMode(mode: ThemeMode): ThemeMode {
  const idx = MODES.indexOf(mode);
  return MODES[(idx + 1) % MODES.length];
}

/** Build and insert the theme toggle button into the toolbar. */
export function buildThemeToggle(): void {
  const toolbarRight = document.querySelector('.toolbar-right');
  if (!toolbarRight) return;

  mediaQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  currentMode = getStoredMode();
  applyTheme(currentMode);

  const btn = document.createElement('button');
  btn.className = 'theme-toggle';
  btn.setAttribute('aria-label', t('toolbar.theme'));

  function updateLabel(): void {
    btn.textContent = `${getIcon(currentMode)} ${getLabel(currentMode)}`;
    btn.setAttribute('aria-label', `${t('toolbar.theme')}: ${getLabel(currentMode)}`);
    btn.title = currentMode === 'system'
      ? "Follow your system's light/dark preference"
      : t('toolbar.theme');
  }

  updateLabel();

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    currentMode = nextMode(currentMode);
    globalThis.localStorage?.setItem(STORAGE_KEY, currentMode);
    applyTheme(currentMode);
    updateLabel();
  });

  // Listen for system preference changes
  mediaQuery?.addEventListener('change', () => {
    if (currentMode === 'system') applyTheme('system');
  });

  // Update labels on locale change
  onLocaleChange(() => {
    updateLabel();
  });

  // Insert before the lang switcher separator
  const langSwitcher = document.getElementById('lang-switcher');
  if (langSwitcher) {
    const sep = document.createElement('span');
    sep.className = 'toolbar-separator';
    toolbarRight.insertBefore(sep, langSwitcher);
    toolbarRight.insertBefore(btn, sep);
  } else {
    toolbarRight.appendChild(btn);
  }
}

/**
 * Initialize theme on page load (for non-editor pages like doc list).
 * Applies stored preference and wires up an existing #theme-toggle button if present.
 */
export function initTheme(): void {
  mediaQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  currentMode = getStoredMode();
  applyTheme(currentMode);

  mediaQuery?.addEventListener('change', () => {
    if (currentMode === 'system') applyTheme('system');
  });

  // Wire up an existing theme toggle button (e.g. on doc-list page)
  const existingBtn = document.getElementById('theme-toggle') as HTMLButtonElement | null;
  if (existingBtn) {
    function updateExistingBtn(): void {
      existingBtn!.textContent = `${getIcon(currentMode)} ${getLabel(currentMode)}`;
      existingBtn!.setAttribute('aria-label', `Theme: ${getLabel(currentMode)}`);
    }

    updateExistingBtn();

    existingBtn.addEventListener('click', (e) => {
      e.preventDefault();
      currentMode = nextMode(currentMode);
      globalThis.localStorage?.setItem(STORAGE_KEY, currentMode);
      applyTheme(currentMode);
      updateExistingBtn();
    });

    onLocaleChange(() => updateExistingBtn());
  }
}
