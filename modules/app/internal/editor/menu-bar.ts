/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { getIcon } from './toolbar-icons.ts';
import { type MenuItem, buildMenuDefs } from './menu-bar-menus.ts';

export function buildMenuBar(editor: Editor): { el: HTMLElement; cleanup: () => void } {
  const menus = buildMenuDefs(editor);
  const wrapper = document.createElement('div');
  wrapper.className = 'menu-bar-hamburger';

  const trigger = document.createElement('button');
  trigger.className = 'toolbar-btn toolbar-btn--icon menu-bar-hamburger-btn';
  trigger.setAttribute('aria-label', 'Menu');
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = getIcon('hamburger');

  const panel = document.createElement('div');
  panel.className = 'hamburger-panel';
  panel.setAttribute('role', 'menu');

  const expandedSections = new Set<string>();

  function renderPanel(): void {
    panel.innerHTML = '';
    for (const menu of menus) {
      const section = document.createElement('div');
      section.className = 'hamburger-section';
      const isExpanded = expandedSections.has(menu.label);

      const header = document.createElement('button');
      header.className = 'hamburger-section-header';
      header.setAttribute('role', 'menuitem');
      header.setAttribute('aria-expanded', String(isExpanded));

      const label = document.createElement('span');
      label.textContent = menu.label;

      const chevron = document.createElement('span');
      chevron.className = 'hamburger-chevron';
      chevron.innerHTML = getIcon('chevronRight');
      if (isExpanded) chevron.classList.add('is-expanded');

      header.append(label, chevron);

      const body = document.createElement('div');
      body.className = 'hamburger-section-body';
      if (!isExpanded) body.hidden = true;
      renderItems(body, menu.items);

      header.addEventListener('click', (e) => {
        e.stopPropagation();
        if (expandedSections.has(menu.label)) {
          expandedSections.delete(menu.label);
        } else {
          expandedSections.add(menu.label);
        }
        renderPanel();
      });

      section.append(header, body);
      panel.appendChild(section);
    }
  }

  function renderItems(container: HTMLElement, items: MenuItem[]): void {
    for (const item of items) {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'menu-bar-sep';
        sep.setAttribute('role', 'separator');
        container.appendChild(sep);
        continue;
      }
      const entry = document.createElement('button');
      entry.className = 'menu-bar-entry';
      entry.setAttribute('role', 'menuitem');

      const icon = document.createElement('span');
      icon.className = 'menu-bar-icon';
      const svg = item.icon ? getIcon(item.icon) : '';
      if (svg) icon.innerHTML = svg;

      const lbl = document.createElement('span');
      lbl.className = 'menu-bar-label';
      lbl.textContent = item.label;

      entry.append(icon, lbl);

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
          close();
          act();
        });
      }

      container.appendChild(entry);
    }
  }

  function open(): void {
    panel.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    const first = panel.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
  }

  function close(): void {
    panel.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.contains('is-open') ? close() : open();
  });

  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close();
      trigger.focus();
    }
  });

  const onDocClick = () => close();
  document.addEventListener('click', onDocClick);

  renderPanel();
  wrapper.append(trigger, panel);

  return {
    el: wrapper,
    cleanup: () => document.removeEventListener('click', onDocClick),
  };
}
