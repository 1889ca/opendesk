/** Contract: contracts/app-sheets/rules.md */
import { TabBar } from './tab-bar.ts';
import type { SheetStore } from './sheet-store.ts';

export function setupTabBar(
  container: HTMLElement | null, store: SheetStore,
  switchSheet: (id: string) => void, activeSheetId: string,
): TabBar | null {
  if (!container) return null;
  const tabBar = new TabBar(container, store, {
    onSwitch: switchSheet,
    onAdd() {
      const meta = store.addSheet();
      tabBar.render();
      switchSheet(meta.id);
    },
    onRename(sheetId, newName) {
      store.renameSheet(sheetId, newName);
      tabBar.render();
    },
    onDelete(sheetId) {
      if (store.getSheets().length <= 1) return;
      if (!store.deleteSheet(sheetId)) return;
      tabBar.render();
      if (activeSheetId === sheetId) switchSheet(store.getSheets()[0].id);
    },
    onDuplicate(sheetId) {
      const meta = store.duplicateSheet(sheetId);
      if (!meta) return;
      tabBar.render();
      switchSheet(meta.id);
    },
  }, activeSheetId);
  return tabBar;
}
