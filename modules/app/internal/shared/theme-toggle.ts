/** Contract: contracts/app/rules.md */
import { t, onLocaleChange } from '../i18n/index.ts';

type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'opendesk-theme';
const ACCENT_KEY = 'opendesk-accent';
const MODES: ThemeMode[] = ['light', 'dark', 'system'];

const ACCENT_PRESETS = [
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Green', value: '#059669' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Teal', value: '#0d9488' },
];

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

/** Apply accent color to CSS custom properties. */
function applyAccent(hex: string): void {
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

/** Darken a hex color by a percentage. */
function darken(hex: string, pct: number): string {
  const r = Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * (1 - pct / 100)));
  const g = Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * (1 - pct / 100)));
  const b = Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * (1 - pct / 100)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function getStoredAccent(): string {
  return globalThis.localStorage?.getItem(ACCENT_KEY) || ACCENT_PRESETS[0].value;
}

/** Get the icon for the current mode. */
function getIcon(mode: ThemeMode): string {
  const iconMap: Record<ThemeMode, string> = { light: '\u2600', dark: '\u263E', system: '\u25D0' };
  return iconMap[mode];
}

function getLabel(mode: ThemeMode): string {
  const labelMap: Record<ThemeMode, string> = {
    light: t('theme.light'), dark: t('theme.dark'), system: t('theme.system'),
  };
  return labelMap[mode];
}

/** Cycle to the next mode. */
function nextMode(mode: ThemeMode): ThemeMode {
  return MODES[(MODES.indexOf(mode) + 1) % MODES.length];
}

/** Build and insert the theme toggle button into the toolbar. */
export function buildThemeToggle(): void {
  const toolbarRight = document.querySelector('.toolbar-right');
  if (!toolbarRight) return;

  mediaQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  currentMode = getStoredMode();
  applyTheme(currentMode);
  applyAccent(getStoredAccent());

  // Settings dropdown wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'settings-dropdown-wrapper';

  const btn = document.createElement('button');
  btn.className = 'theme-toggle';
  btn.setAttribute('aria-label', t('toolbar.theme'));

  const dropdown = buildSettingsDropdown();
  wrapper.appendChild(btn);
  wrapper.appendChild(dropdown);

  function updateLabel(): void {
    btn.textContent = `${getIcon(currentMode)} ${getLabel(currentMode)}`;
    btn.setAttribute('aria-label', `${t('toolbar.theme')}: ${getLabel(currentMode)}`);
  }
  updateLabel();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('settings-dropdown-open');
  });

  document.addEventListener('click', () => {
    dropdown.classList.remove('settings-dropdown-open');
  });

  mediaQuery?.addEventListener('change', () => {
    if (currentMode === 'system') applyTheme('system');
  });

  onLocaleChange(() => { updateLabel(); btn.title = t('toolbar.theme'); });

  const langSwitcher = document.getElementById('lang-switcher');
  if (langSwitcher) {
    const sep = document.createElement('span');
    sep.className = 'toolbar-separator';
    toolbarRight.insertBefore(sep, langSwitcher);
    toolbarRight.insertBefore(wrapper, sep);
  } else {
    toolbarRight.appendChild(wrapper);
  }

  function buildSettingsDropdown(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'settings-dropdown';
    panel.addEventListener('click', (e) => e.stopPropagation());

    // Mode switcher
    const modeSection = document.createElement('div');
    modeSection.className = 'settings-section';
    const modeLabel = document.createElement('div');
    modeLabel.className = 'settings-label';
    modeLabel.textContent = t('theme.mode');
    modeSection.appendChild(modeLabel);

    const modeGroup = document.createElement('div');
    modeGroup.className = 'settings-mode-group';
    for (const mode of MODES) {
      const modeBtn = document.createElement('button');
      modeBtn.className = 'settings-mode-btn' + (mode === currentMode ? ' active' : '');
      modeBtn.textContent = `${getIcon(mode)} ${getLabel(mode)}`;
      modeBtn.addEventListener('click', () => {
        currentMode = mode;
        globalThis.localStorage?.setItem(STORAGE_KEY, mode);
        applyTheme(mode);
        updateLabel();
        modeGroup.querySelectorAll('.settings-mode-btn').forEach((b) => b.classList.remove('active'));
        modeBtn.classList.add('active');
      });
      modeGroup.appendChild(modeBtn);
    }
    modeSection.appendChild(modeGroup);
    panel.appendChild(modeSection);

    // Accent color section
    const accentSection = document.createElement('div');
    accentSection.className = 'settings-section';
    const accentLabel = document.createElement('div');
    accentLabel.className = 'settings-label';
    accentLabel.textContent = t('theme.accentColor');
    accentSection.appendChild(accentLabel);

    const swatches = document.createElement('div');
    swatches.className = 'settings-swatches';
    const storedAccent = getStoredAccent();

    for (const preset of ACCENT_PRESETS) {
      const swatch = document.createElement('button');
      swatch.className = 'settings-swatch' + (preset.value === storedAccent ? ' active' : '');
      swatch.style.background = preset.value;
      swatch.title = preset.name;
      swatch.setAttribute('aria-label', preset.name);
      swatch.addEventListener('click', () => {
        globalThis.localStorage?.setItem(ACCENT_KEY, preset.value);
        applyAccent(preset.value);
        swatches.querySelectorAll('.settings-swatch').forEach((s) => s.classList.remove('active'));
        swatch.classList.add('active');
        colorInput.value = preset.value;
      });
      swatches.appendChild(swatch);
    }
    accentSection.appendChild(swatches);

    // Custom color picker
    const colorRow = document.createElement('div');
    colorRow.className = 'settings-color-row';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'settings-color-input';
    colorInput.value = storedAccent;
    colorInput.addEventListener('input', () => {
      const hex = colorInput.value;
      globalThis.localStorage?.setItem(ACCENT_KEY, hex);
      applyAccent(hex);
      swatches.querySelectorAll('.settings-swatch').forEach((s) => s.classList.remove('active'));
    });
    const colorLabel = document.createElement('span');
    colorLabel.className = 'settings-color-label';
    colorLabel.textContent = t('theme.custom');
    colorRow.appendChild(colorInput);
    colorRow.appendChild(colorLabel);
    accentSection.appendChild(colorRow);

    panel.appendChild(accentSection);
    return panel;
  }
}

/**
 * Initialize theme on page load (for non-editor pages).
 * Applies stored preference without creating a toggle button.
 */
export function initTheme(): void {
  mediaQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  currentMode = getStoredMode();
  applyTheme(currentMode);
  applyAccent(getStoredAccent());

  mediaQuery?.addEventListener('change', () => {
    if (currentMode === 'system') applyTheme('system');
  });
}
