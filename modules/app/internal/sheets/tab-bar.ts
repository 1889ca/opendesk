/** Contract: contracts/sheets-tabs/rules.md */
import type { SheetStore, SheetMeta } from './sheet-store.ts';
import { showContextMenu, closeContextMenu } from './tab-context-menu.ts';

export interface TabBarCallbacks {
  onSwitch: (sheetId: string) => void;
  onAdd: () => void;
  onRename: (sheetId: string, newName: string) => void;
  onDelete: (sheetId: string) => void;
  onDuplicate: (sheetId: string) => void;
}

/** Creates and manages the sheet tab bar UI. */
export class TabBar {
  private container: HTMLElement;
  private store: SheetStore;
  private callbacks: TabBarCallbacks;
  private activeSheetId: string;
  private tabsEl: HTMLElement;

  constructor(
    parent: HTMLElement, store: SheetStore,
    callbacks: TabBarCallbacks, activeSheetId: string,
  ) {
    this.store = store;
    this.callbacks = callbacks;
    this.activeSheetId = activeSheetId;

    this.container = document.createElement('div');
    this.container.className = 'sheet-tab-bar';

    this.tabsEl = document.createElement('div');
    this.tabsEl.className = 'sheet-tabs';
    this.container.appendChild(this.tabsEl);

    const addBtn = document.createElement('button');
    addBtn.className = 'sheet-tab-add';
    addBtn.textContent = '+';
    addBtn.title = 'Add sheet';
    addBtn.addEventListener('click', () => this.callbacks.onAdd());
    this.container.appendChild(addBtn);

    parent.appendChild(this.container);
    this.render();
  }

  /** Update which tab is active and re-render. */
  setActive(sheetId: string): void {
    this.activeSheetId = sheetId;
    this.render();
  }

  /** Re-render the tab bar from the store state. */
  render(): void {
    this.tabsEl.innerHTML = '';
    const sheets = this.store.getSheets();

    for (const sheet of sheets) {
      const tab = this.createTab(sheet, sheets.length);
      this.tabsEl.appendChild(tab);
    }
  }

  private createTab(sheet: SheetMeta, totalSheets: number): HTMLElement {
    const tab = document.createElement('button');
    tab.className = 'sheet-tab';
    if (sheet.id === this.activeSheetId) {
      tab.classList.add('sheet-tab-active');
    }
    tab.textContent = sheet.name;
    tab.dataset.sheetId = sheet.id;

    tab.addEventListener('click', () => {
      this.callbacks.onSwitch(sheet.id);
    });

    tab.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.startRename(tab, sheet);
    });

    tab.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Rename', action: () => this.startRename(tab, sheet) },
        {
          label: 'Duplicate',
          action: () => this.callbacks.onDuplicate(sheet.id),
        },
        {
          label: 'Delete',
          action: () => this.callbacks.onDelete(sheet.id),
          disabled: totalSheets <= 1,
        },
      ]);
    });

    return tab;
  }

  private startRename(tab: HTMLElement, sheet: SheetMeta): void {
    closeContextMenu();
    const input = document.createElement('input');
    input.className = 'sheet-tab-rename';
    input.value = sheet.name;
    input.type = 'text';

    tab.textContent = '';
    tab.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
      const newName = input.value.trim();
      if (newName && newName !== sheet.name) {
        this.callbacks.onRename(sheet.id, newName);
      }
      this.render();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
      if (e.key === 'Escape') {
        input.value = sheet.name;
        input.blur();
      }
    });
  }

  /** Clean up the tab bar from the DOM. */
  destroy(): void {
    this.container.remove();
  }
}
