/** Contract: contracts/sheets-tabs/rules.md */

export interface ContextMenuAction {
  label: string;
  action: () => void;
  disabled?: boolean;
}

let activeMenu: HTMLElement | null = null;

/** Close any open context menu. */
export function closeContextMenu(): void {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
}

/** Show a context menu at the given position. */
export function showContextMenu(
  x: number, y: number, actions: ContextMenuAction[],
): void {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'sheet-context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  for (const item of actions) {
    const btn = document.createElement('button');
    btn.className = 'sheet-context-menu-item';
    btn.textContent = item.label;
    btn.disabled = !!item.disabled;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeContextMenu();
      item.action();
    });
    menu.appendChild(btn);
  }

  document.body.appendChild(menu);
  activeMenu = menu;

  const dismiss = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      closeContextMenu();
      document.removeEventListener('click', dismiss);
    }
  };
  requestAnimationFrame(() => {
    document.addEventListener('click', dismiss);
  });
}
