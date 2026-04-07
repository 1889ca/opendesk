/** Contract: contracts/app/rules.md */
import { t, onLocaleChange, type TranslationKey } from './i18n/index.ts';

const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
const MOD = isMac ? '\u2318' : 'Ctrl';

interface ShortcutEntry { keys: string; labelKey: TranslationKey; }
interface ShortcutGroup { titleKey: TranslationKey; entries: ShortcutEntry[]; }

function getGroups(): ShortcutGroup[] {
  return [
    { titleKey: 'shortcuts.formatting', entries: [
      { keys: `${MOD}+B`, labelKey: 'shortcuts.bold' },
      { keys: `${MOD}+I`, labelKey: 'shortcuts.italic' },
      { keys: `${MOD}+Shift+X`, labelKey: 'shortcuts.strikethrough' },
      { keys: `${MOD}+E`, labelKey: 'shortcuts.code' },
      { keys: `${MOD}+Alt+1`, labelKey: 'shortcuts.heading1' },
      { keys: `${MOD}+Alt+2`, labelKey: 'shortcuts.heading2' },
      { keys: `${MOD}+Alt+3`, labelKey: 'shortcuts.heading3' },
      { keys: `${MOD}+Shift+8`, labelKey: 'shortcuts.bulletList' },
      { keys: `${MOD}+Shift+7`, labelKey: 'shortcuts.orderedList' },
      { keys: `${MOD}+Shift+B`, labelKey: 'shortcuts.blockquote' },
      { keys: `${MOD}+Alt+C`, labelKey: 'shortcuts.codeBlock' },
    ]},
    { titleKey: 'shortcuts.comments', entries: [
      { keys: `${MOD}+Shift+M`, labelKey: 'shortcuts.addComment' },
    ]},
    { titleKey: 'shortcuts.search', entries: [
      { keys: `${MOD}+F`, labelKey: 'shortcuts.find' },
      { keys: `${MOD}+H`, labelKey: 'shortcuts.findReplace' },
    ]},
    { titleKey: 'shortcuts.document', entries: [
      { keys: `${MOD}+Z`, labelKey: 'shortcuts.undo' },
      { keys: `${MOD}+Shift+Z`, labelKey: 'shortcuts.redo' },
      { keys: `${MOD}+/`, labelKey: 'shortcuts.showShortcuts' },
    ]},
  ];
}

let overlay: HTMLElement | null = null;

function renderDialog(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'shortcut-overlay';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', t('shortcuts.title'));
  const modal = document.createElement('div');
  modal.className = 'shortcut-modal';
  const header = document.createElement('div');
  header.className = 'shortcut-header';
  const title = document.createElement('h2');
  title.className = 'shortcut-title';
  title.textContent = t('shortcuts.title');
  const closeBtn = document.createElement('button');
  closeBtn.className = 'shortcut-close';
  closeBtn.textContent = '\u2715';
  closeBtn.setAttribute('aria-label', t('shortcuts.close'));
  closeBtn.addEventListener('click', closeShortcutDialog);
  header.append(title, closeBtn);
  modal.appendChild(header);
  const body = document.createElement('div');
  body.className = 'shortcut-body';
  for (const group of getGroups()) {
    const section = document.createElement('div');
    section.className = 'shortcut-section';
    const heading = document.createElement('h3');
    heading.className = 'shortcut-section-title';
    heading.textContent = t(group.titleKey);
    section.appendChild(heading);
    const list = document.createElement('dl');
    list.className = 'shortcut-list';
    for (const entry of group.entries) {
      const row = document.createElement('div');
      row.className = 'shortcut-row';
      const dt = document.createElement('dt');
      dt.textContent = t(entry.labelKey);
      const dd = document.createElement('dd');
      const kbd = document.createElement('kbd');
      kbd.textContent = entry.keys;
      dd.appendChild(kbd);
      row.append(dt, dd);
      list.appendChild(row);
    }
    section.appendChild(list);
    body.appendChild(section);
  }
  modal.appendChild(body);
  el.appendChild(modal);
  el.addEventListener('click', (e) => { if (e.target === el) closeShortcutDialog(); });
  return el;
}

export function openShortcutDialog(): void {
  if (overlay) return;
  overlay = renderDialog();
  document.body.appendChild(overlay);
  (overlay.querySelector('.shortcut-close') as HTMLElement)?.focus();
  document.addEventListener('keydown', handleDialogKeys);
}

export function closeShortcutDialog(): void {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  document.removeEventListener('keydown', handleDialogKeys);
}

function handleDialogKeys(e: KeyboardEvent): void {
  if (e.key === 'Escape') { e.preventDefault(); closeShortcutDialog(); }
}

export function bindShortcutDialogKey(): void {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      overlay ? closeShortcutDialog() : openShortcutDialog();
    }
  });
  onLocaleChange(() => { if (overlay) { closeShortcutDialog(); openShortcutDialog(); } });
}
