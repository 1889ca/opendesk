/** Contract: contracts/app/slides-interaction.md */

import { THEME_PRESETS, type SlideTheme } from './themes.ts';

type ThemeSelectCallback = (theme: SlideTheme) => void;

/** Create a theme picker dropdown for the slides toolbar. */
export function createThemePicker(
  currentThemeId: string,
  onSelect: ThemeSelectCallback,
): { element: HTMLElement; setActive: (id: string) => void; destroy: () => void } {
  const wrapper = document.createElement('div');
  wrapper.className = 'slide-theme-picker';

  const btn = document.createElement('button');
  btn.className = 'btn btn-secondary btn-sm slide-theme-picker__btn';
  btn.textContent = 'Theme';
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');

  const menu = document.createElement('div');
  menu.className = 'slide-theme-picker__menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  let activeId = currentThemeId;

  function renderItems() {
    menu.innerHTML = '';
    for (const theme of THEME_PRESETS) {
      const item = document.createElement('button');
      item.className = 'slide-theme-picker__item' + (theme.id === activeId ? ' active' : '');
      item.setAttribute('role', 'menuitem');

      const swatch = document.createElement('div');
      swatch.className = 'slide-theme-picker__swatch';
      swatch.style.background = theme.background;
      swatch.style.borderColor = theme.accentColor;

      const colors = document.createElement('div');
      colors.className = 'slide-theme-picker__colors';
      const dot1 = document.createElement('span');
      dot1.style.background = theme.headingColor;
      const dot2 = document.createElement('span');
      dot2.style.background = theme.accentColor;
      const dot3 = document.createElement('span');
      dot3.style.background = theme.textColor;
      colors.append(dot1, dot2, dot3);
      swatch.appendChild(colors);

      const label = document.createElement('span');
      label.className = 'slide-theme-picker__label';
      label.textContent = theme.name;

      item.append(swatch, label);
      item.addEventListener('click', () => {
        activeId = theme.id;
        onSelect(theme);
        renderItems();
        close();
      });
      menu.appendChild(item);
    }
  }

  renderItems();

  function toggle() {
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  }

  function close() {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });

  function handleOutsideClick(e: MouseEvent) {
    if (!wrapper.contains(e.target as Node)) close();
  }
  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  document.addEventListener('click', handleOutsideClick);
  document.addEventListener('keydown', handleEscape);

  wrapper.append(btn, menu);

  return {
    element: wrapper,
    setActive(id: string) {
      activeId = id;
      renderItems();
    },
    destroy() {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
      wrapper.remove();
    },
  };
}
