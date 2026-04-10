/** Contract: contracts/app/rules.md */

/**
 * Profile chip — toolbar widget showing the user's display name.
 *
 * Clicking opens a small popover with:
 *   - current name
 *   - "Change name" button that re-opens the name setup modal
 *
 * When the name changes, the chip label and auth token are updated.
 *
 * Issue #170: user identity in the UI.
 */

import { showNameChangeModal } from './name-change.ts';
import { getLocale, setLocale, persistLocale, type Locale } from '../i18n/index.ts';

const LS_USER_NAME = 'opendesk:userName';

/**
 * Builds and returns the profile chip element.
 * Insert it anywhere in the toolbar.
 */
export function buildProfileChip(): HTMLElement {
  const name = getDisplayName();

  const chip = document.createElement('div');
  chip.className = 'profile-chip';
  chip.setAttribute('role', 'button');
  chip.setAttribute('tabindex', '0');
  chip.setAttribute('aria-haspopup', 'true');
  chip.setAttribute('aria-expanded', 'false');
  chip.title = 'Your profile';

  const avatar = document.createElement('span');
  avatar.className = 'profile-chip-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = nameInitial(name);
  chip.appendChild(avatar);

  const label = document.createElement('span');
  label.className = 'profile-chip-label';
  label.textContent = name;
  chip.appendChild(label);

  // Popover
  const popover = document.createElement('div');
  popover.className = 'profile-popover';
  popover.hidden = true;
  popover.setAttribute('role', 'menu');

  const nameDisplay = document.createElement('p');
  nameDisplay.className = 'profile-popover-name';
  nameDisplay.textContent = name;
  popover.appendChild(nameDisplay);

  const changeBtn = document.createElement('button');
  changeBtn.type = 'button';
  changeBtn.className = 'profile-popover-change-btn';
  changeBtn.setAttribute('role', 'menuitem');
  changeBtn.textContent = 'Change name';
  popover.appendChild(changeBtn);

  // Language preference
  const langRow = document.createElement('div');
  langRow.className = 'profile-popover-lang-row';
  const langLabel = document.createElement('label');
  langLabel.className = 'profile-popover-lang-label';
  langLabel.textContent = 'Language';
  const langSelect = document.createElement('select');
  langSelect.className = 'profile-popover-lang-select';
  const locales: { value: Locale; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'Français' },
  ];
  for (const { value, label } of locales) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    opt.selected = value === getLocale();
    langSelect.appendChild(opt);
  }
  langSelect.addEventListener('change', () => {
    const next = langSelect.value as Locale;
    setLocale(next);
    persistLocale(next);
  });
  langLabel.appendChild(langSelect);
  langRow.appendChild(langLabel);
  popover.appendChild(langRow);

  chip.appendChild(popover);

  let open = false;

  function openPopover(): void {
    open = true;
    popover.hidden = false;
    chip.setAttribute('aria-expanded', 'true');
  }

  function closePopover(): void {
    open = false;
    popover.hidden = true;
    chip.setAttribute('aria-expanded', 'false');
  }

  function toggle(): void {
    if (open) closePopover();
    else openPopover();
  }

  chip.addEventListener('click', (e) => {
    if (popover.contains(e.target as Node)) return;
    toggle();
  });

  chip.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
    if (e.key === 'Escape') closePopover();
  });

  document.addEventListener('click', (e) => {
    if (open && !chip.contains(e.target as Node)) closePopover();
  });

  changeBtn.addEventListener('click', async () => {
    closePopover();
    const newName = await showNameChangeModal(getDisplayName());
    if (newName) {
      label.textContent = newName;
      nameDisplay.textContent = newName;
      avatar.textContent = nameInitial(newName);
    }
  });

  return chip;
}

function getDisplayName(): string {
  try {
    return localStorage.getItem(LS_USER_NAME) ?? 'Anonymous';
  } catch {
    return 'Anonymous';
  }
}

function nameInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}
