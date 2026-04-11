/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { getIcon } from './toolbar-icons.ts';
import { type MenuItem, buildMenuDefs } from './menu-bar-menus.ts';

export function buildMenuBar(editor: Editor): { el: HTMLElement; cleanup: () => void } {
  const menus = buildMenuDefs(editor);
  const bar = document.createElement('nav');
  bar.className = 'menu-bar';
  bar.setAttribute('role', 'menubar');
  bar.setAttribute('aria-label', 'Menu');

  let activeDropdown: HTMLElement | null = null;
  let activeTrigger: HTMLElement | null = null;
  let switchedViaHover = false;

  function open(trigger: HTMLElement, dropdown: HTMLElement): void {
    close();
    activeDropdown = dropdown;
    activeTrigger = trigger;
    dropdown.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('is-active');
    const first = dropdown.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
  }

  function close(): void {
    if (!activeDropdown) return;
    activeDropdown.classList.remove('is-open');
    activeTrigger?.setAttribute('aria-expanded', 'false');
    activeTrigger?.classList.remove('is-active');
    activeDropdown = null;
    activeTrigger = null;
  }

  const triggers: HTMLElement[] = [];
  const dropdowns: HTMLElement[] = [];

  for (const menu of menus) {
    const wrapper = document.createElement('div');
    wrapper.className = 'menu-bar-group';

    const trigger = document.createElement('button');
    trigger.className = 'menu-bar-trigger';
    trigger.setAttribute('role', 'menuitem');
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.textContent = menu.label;

    const dropdown = renderDropdown(menu.items, close);

    trigger.addEventListener('mouseenter', () => {
      if (activeDropdown && activeDropdown !== dropdown) {
        open(trigger, dropdown);
        switchedViaHover = true;
        requestAnimationFrame(() => { switchedViaHover = false; });
      }
    });

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (switchedViaHover) return;
      activeDropdown === dropdown ? close() : open(trigger, dropdown);
    });

    triggers.push(trigger);
    dropdowns.push(dropdown);
    wrapper.append(trigger, dropdown);
    bar.appendChild(wrapper);
  }

  bar.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); activeTrigger?.focus(); return; }
    if (!activeTrigger) return;
    const idx = triggers.indexOf(activeTrigger);

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (idx + 1) % triggers.length;
      open(triggers[next], dropdowns[next]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (idx - 1 + triggers.length) % triggers.length;
      open(triggers[prev], dropdowns[prev]);
    }
  });

  const onDocClick = () => close();
  document.addEventListener('click', onDocClick);

  return {
    el: bar,
    cleanup: () => document.removeEventListener('click', onDocClick),
  };
}

function renderDropdown(items: MenuItem[], onClose: () => void): HTMLElement {
  const dropdown = document.createElement('div');
  dropdown.className = 'menu-bar-dropdown';
  dropdown.setAttribute('role', 'menu');

  const entries: HTMLElement[] = [];

  for (const item of items) {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'menu-bar-sep';
      sep.setAttribute('role', 'separator');
      dropdown.appendChild(sep);
      continue;
    }

    const entry = document.createElement('button');
    entry.className = 'menu-bar-entry';
    entry.setAttribute('role', 'menuitem');

    const icon = document.createElement('span');
    icon.className = 'menu-bar-icon';
    const svg = item.icon ? getIcon(item.icon) : '';
    if (svg) icon.innerHTML = svg;

    const label = document.createElement('span');
    label.className = 'menu-bar-label';
    label.textContent = item.label;

    entry.append(icon, label);

    if (item.shortcut) {
      const kbd = document.createElement('kbd');
      kbd.className = 'menu-bar-kbd';
      kbd.textContent = item.shortcut;
      entry.appendChild(kbd);
    }

    if (item.action) {
      const act = item.action;
      entry.addEventListener('click', (e) => {
        e.stopPropagation();
        onClose();
        act();
      });
    }

    entries.push(entry);
    dropdown.appendChild(entry);
  }

  dropdown.addEventListener('keydown', (e) => {
    const idx = entries.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      entries[(idx + 1) % entries.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      entries[(idx - 1 + entries.length) % entries.length]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      (document.activeElement as HTMLElement)?.click();
    }
  });

  return dropdown;
}
