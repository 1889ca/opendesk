/** Contract: contracts/app/rules.md */
import { t, onLocaleChange } from '../i18n/index.ts';
import { ACCENT_PRESETS, applyAccent, getStoredAccent, saveAccent } from './accent-color.ts';

type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'opendesk-theme';
const MODES: ThemeMode[] = ['light', 'dark', 'system'];

let currentMode: ThemeMode = 'system';
let mediaQuery: MediaQueryList | null = null;

function getStoredMode(): ThemeMode {
  const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function resolveEffective(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode;
  return mediaQuery?.matches ? 'dark' : 'light';
}

function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', resolveEffective(mode));
}

function getIcon(mode: ThemeMode): string {
  return { light: '\u2600', dark: '\u263E', system: '\u25D0' }[mode];
}

function getLabel(mode: ThemeMode): string {
  return { light: t('theme.light'), dark: t('theme.dark'), system: t('theme.system') }[mode];
}

/** Build the settings dropdown panel content. */
function buildSettingsPanel(updateLabel: () => void): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'settings-dropdown';
  panel.addEventListener('click', (e) => e.stopPropagation());

  // Mode section
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

  // Accent section
  const accentSection = document.createElement('div');
  accentSection.className = 'settings-section';
  const al = document.createElement('div');
  al.className = 'settings-label';
  al.textContent = t('theme.accentColor');
  accentSection.appendChild(al);

  const swatches = document.createElement('div');
  swatches.className = 'settings-swatches';
  const stored = getStoredAccent();

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'settings-color-input';
  colorInput.value = stored;

  for (const preset of ACCENT_PRESETS) {
    const swatch = document.createElement('button');
    swatch.className = 'settings-swatch' + (preset.value === stored ? ' active' : '');
    swatch.style.background = preset.value;
    swatch.title = preset.name;
    swatch.addEventListener('click', () => {
      saveAccent(preset.value);
      applyAccent(preset.value);
      swatches.querySelectorAll('.settings-swatch').forEach((s) => s.classList.remove('active'));
      swatch.classList.add('active');
      colorInput.value = preset.value;
    });
    swatches.appendChild(swatch);
  }
  accentSection.appendChild(swatches);

  colorInput.addEventListener('input', () => {
    saveAccent(colorInput.value);
    applyAccent(colorInput.value);
    swatches.querySelectorAll('.settings-swatch').forEach((s) => s.classList.remove('active'));
  });

  const colorRow = document.createElement('div');
  colorRow.className = 'settings-color-row';
  const cl = document.createElement('span');
  cl.className = 'settings-color-label';
  cl.textContent = t('theme.custom');
  colorRow.appendChild(colorInput);
  colorRow.appendChild(cl);
  accentSection.appendChild(colorRow);
  panel.appendChild(accentSection);

  return panel;
}

/** Build and insert the theme toggle button into the toolbar. */
export function buildThemeToggle(): void {
  const toolbarRight = document.querySelector('.toolbar-right');
  if (!toolbarRight) return;

  mediaQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  currentMode = getStoredMode();
  applyTheme(currentMode);
  applyAccent(getStoredAccent());

  const wrapper = document.createElement('div');
  wrapper.className = 'settings-dropdown-wrapper';

  const btn = document.createElement('button');
  btn.className = 'theme-toggle';
  btn.setAttribute('aria-label', t('toolbar.theme'));

  function updateLabel(): void {
    btn.textContent = `${getIcon(currentMode)} ${getLabel(currentMode)}`;
    btn.setAttribute('aria-label', `${t('toolbar.theme')}: ${getLabel(currentMode)}`);
  }
  updateLabel();

  const dropdown = buildSettingsPanel(updateLabel);
  wrapper.appendChild(btn);
  wrapper.appendChild(dropdown);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('settings-dropdown-open');
  });
  document.addEventListener('click', () => dropdown.classList.remove('settings-dropdown-open'));

  mediaQuery?.addEventListener('change', () => {
    if (currentMode === 'system') applyTheme('system');
  });
  onLocaleChange(() => { updateLabel(); });

  const langSwitcher = document.getElementById('lang-switcher');
  if (langSwitcher) {
    const sep = document.createElement('span');
    sep.className = 'toolbar-separator';
    toolbarRight.insertBefore(sep, langSwitcher);
    toolbarRight.insertBefore(wrapper, sep);
  } else {
    toolbarRight.appendChild(wrapper);
  }
}

/** Initialize theme without building toggle UI. */
export function initTheme(): void {
  mediaQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  currentMode = getStoredMode();
  applyTheme(currentMode);
  applyAccent(getStoredAccent());
  mediaQuery?.addEventListener('change', () => {
    if (currentMode === 'system') applyTheme('system');
  });
}
