/** Contract: contracts/app/rules.md */
import {
  t, setLocale, getLocale, persistLocale, onLocaleChange,
  type Locale,
} from './i18n/index.ts';

/** Build language switcher dropdown in the #lang-switcher container. */
export function buildLanguageSwitcher() {
  const container = document.getElementById('lang-switcher');
  if (!container) return;

  const render = () => {
    container.innerHTML = '';
    const select = document.createElement('select');
    select.className = 'lang-select';
    select.setAttribute('aria-label', t('lang.label'));

    const localeList: Locale[] = ['en', 'fr'];
    for (const loc of localeList) {
      const opt = document.createElement('option');
      opt.value = loc;
      opt.textContent = t(`lang.${loc}` as const);
      opt.selected = loc === getLocale();
      select.appendChild(opt);
    }

    select.addEventListener('change', () => {
      const next = select.value as Locale;
      setLocale(next);
      persistLocale(next);
    });
    container.appendChild(select);
  };

  render();
  onLocaleChange(render);
}

/** Update all static text elements in the editor chrome. */
export function updateStaticText(statusEl: HTMLElement | null) {
  const editorsLabel = document.querySelector('.users-label');
  if (editorsLabel) editorsLabel.textContent = t('editor.editors');

  const backLink = document.querySelector('.back-link');
  if (backLink) backLink.textContent = t('editor.backToDocuments');

  const exportHtml = document.getElementById('export-html');
  if (exportHtml) {
    exportHtml.textContent = t('export.html');
    exportHtml.title = t('export.htmlTitle');
  }

  const exportText = document.getElementById('export-text');
  if (exportText) {
    exportText.textContent = t('export.text');
    exportText.title = t('export.textTitle');
  }

  if (statusEl) {
    const isConnected = statusEl.classList.contains('connected');
    statusEl.textContent = isConnected
      ? t('status.connected')
      : t('status.disconnected');
  }
}
